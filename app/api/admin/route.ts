import { publicationTime } from '@/lib/publication.mjs';
import {assertRedemptionPublish} from '@/lib/redemption-config.mjs';
import {validateBrand} from '@/lib/brand-domain.mjs';
import { env } from 'cloudflare:workers';
import {
  admin,
  csrf,
  database,
  fail,
  HttpError,
  jsonBody,
  limited,
  siteSettings,
} from '@/lib/server';
import {
  validateContent,
  validateSettings,
  validateUrl,
  text,
} from '@/lib/domain.mjs';
import { richAssets } from '@/lib/cms-domain.mjs';
import { validateFooter } from '@/lib/footer-domain.mjs';
import { workflowInput } from '@/lib/list-domain.mjs';
import { cmsAction } from '@/lib/cms-actions';
export async function GET() {
  try {
    const user = await admin(),
      db = database();
    const rows = async (q: string) => (await db.prepare(q).all<any>()).results;
    const [contents, assets, categories, folders, navigation, settings] =
      await Promise.all([
        rows(
          "SELECT id,updated_at,json_object('kind',kind,'slug',slug,'status',status,'titleZh',json_extract(data,'$.titleZh'),'titleEn',json_extract(data,'$.titleEn'),'summaryZh',json_extract(data,'$.summaryZh'),'summaryEn',json_extract(data,'$.summaryEn'),'imageId',json_extract(data,'$.imageId'),'categoryId',json_extract(data,'$.categoryId')) AS data FROM contents ORDER BY updated_at DESC",
        ),
        rows(
          'SELECT assets.*,asset_folders_map.folder_id FROM assets LEFT JOIN asset_folders_map ON assets.id=asset_folders_map.asset_id ORDER BY created_at DESC',
        ),
        rows('SELECT * FROM categories'),
        rows('SELECT * FROM asset_folders ORDER BY name'),
        rows('SELECT * FROM navigation_items'),
        siteSettings(),
      ]);
    const owner = user.role === 'owner';
    const { commerceConfig } = await import('@/lib/orders');
    const legacyOrders = (await commerceConfig()).grants?.[user.email.toLowerCase()] || [];
    const operationPermissions = [...new Set([...user.permissions, ...legacyOrders.map((p: string) => 'orders.' + p)])];
    const [submissions, visits, evidence, admins, logs, policies] = owner
      ? await Promise.all([
          Promise.resolve([]),
          rows('SELECT * FROM visits ORDER BY created_at DESC LIMIT 1000'),
          rows('SELECT * FROM evidence ORDER BY created_at DESC'),
          import('@/lib/identity').then(async ({identity})=>(await identity('staff-directory',{},user.email)).rows),
          Promise.resolve([]),
          rows('SELECT * FROM policies'),
        ])
      : [[], [], [], [], [], []];
    return Response.json(
      {
        contents: contents.map((r) => ({
          ...JSON.parse(r.data),
          id: r.id,
          updatedAt: r.updated_at,
        })),
        assets,
        categories: categories.map((r) => ({ ...JSON.parse(r.data), ...r })),
        folders,
        navigation: navigation.map((r) => ({
          ...JSON.parse(r.data),
          id: r.id,
        })),
        settings,
        pendingCounts: owner ? {
          orders: (await db.prepare("SELECT sandbox,status,COUNT(*) AS count FROM orders WHERE status IN ('pending_review','aftersale') GROUP BY sandbox,status").all()).results,
          submissions: (await db.prepare("SELECT COUNT(*) AS count FROM submissions s LEFT JOIN submission_workflows w ON s.id=w.id WHERE COALESCE(w.status,'pending')='pending'").first<any>()).count,
        } : null,
        submissionCount: owner
          ? (
              await db
                .prepare('SELECT COUNT(*) AS total FROM submissions')
                .first<any>()
            ).total
          : 0,
        submissions: [],
        visits,
        evidence: evidence.map((r) => ({ ...r, ...JSON.parse(r.data) })),
        admins,
        logs,
        policies: policies.map((r) => ({ ...r, ...JSON.parse(r.data) })),
        user: { email: user.email, role: user.role, permissions: operationPermissions },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    csrf(request);
    const input = await jsonBody(request),
      user = await admin(input.action);
    await limited('admin:' + user.userId, 120);
    const db = database(),
      now = new Date().toISOString();
    let statements: any[] = [],
      target = String(input.id || ''),
      result: any = { ok: true };
    try {
      if (input.action === 'saveContent') {
        const checked = validateContent(input.data),
          id = checked.id || crypto.randomUUID(),
          old = await db
            .prepare('SELECT * FROM contents WHERE id=?')
            .bind(id)
            .first<any>();
        if (old && old.kind !== checked.kind)
          throw Error('已有内容不能改变类型');
        if (
          checked.kind === 'products' &&
          checked.spu &&
          (await db
            .prepare(
              "SELECT id FROM contents WHERE kind='products' AND lower(json_extract(data,'$.spu'))=lower(?) AND id<>?",
            )
            .bind(checked.spu, id)
            .first())
        )
          throw Error('商品编码 / SPU 已存在');
        for (const image of checked.imageIds || []) {
          const asset = await db
            .prepare('SELECT mime FROM assets WHERE id=?')
            .bind(image)
            .first<any>();
          if (!asset?.mime.startsWith('image/'))
            throw Error('商品主图必须为图片');
        }
        if(checked.kind==='products' && (checked as any).trade?.redemptionEnabled && (input.redemptionPublish===true || !old || !JSON.parse(old.data).trade?.redemptionEnabled)) assertRedemptionPublish(checked);
        const previous = old ? JSON.parse(old.data) : null;
        const data = { ...previous, ...checked, id, publishedAt: publicationTime(previous, checked.status, now, checked.kind === 'articles' ? input.data?.publishedAt : undefined, old?.status) };
        if(old&&checked.kind==='products'){
          if((input.expectedUpdatedAt && input.expectedUpdatedAt!==old.updated_at)||(!input.expectedUpdatedAt&&await db.prepare('SELECT id FROM order_items WHERE product_id=? LIMIT 1').bind(id).first())) throw Error('商品已更新（可能有订单扣库存），请刷新后重新编辑');
          (data as any)._expectedStockVersion=old.updated_at;
        }
        if (
          checked.linkedFormId &&
          checked.linkedFormId !==
            (old ? JSON.parse(old.data).linkedFormId : '') &&
          !(await db
            .prepare(
              "SELECT id FROM contents WHERE id=? AND kind='forms' AND status='published'",
            )
            .bind(checked.linkedFormId)
            .first())
        )
          throw Error('请选择已发布表单');
        if (
          checked.categoryId &&
          !(await db
            .prepare('SELECT id FROM categories WHERE id=? AND kind=?')
            .bind(checked.categoryId, checked.kind)
            .first())
        )
          throw Error('分类不存在或类型不符');
        if (
          await db
            .prepare(
              'SELECT id FROM contents WHERE kind=? AND slug=? AND id<>?',
            )
            .bind(data.kind, data.slug, id)
            .first()
        )
          throw Error('链接已被使用');
        const assets = [
          ...new Set(
            [
              data.imageId,
              ...(data.imageIds || []),
              ...richAssets(data.richZh),
              ...richAssets(data.richEn),
            ].filter(Boolean),
          ),
        ];
        for (const asset of assets)
          if (
            !(await db
              .prepare('SELECT id FROM assets WHERE id=?')
              .bind(asset)
              .first())
          )
            throw Error('引用的素材不存在');
        statements = [
          db
            .prepare(
              'INSERT INTO contents(id,kind,slug,status,data,updated_at,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,status=excluded.status,data=excluded.data,updated_at=excluded.updated_at',
            )
            .bind(
              id,
              data.kind,
              data.slug,
              data.status,
              JSON.stringify(data),
              now,
              now,
            ),
          db.prepare('DELETE FROM content_assets WHERE content_id=?').bind(id),
          ...assets.map((asset) =>
            db
              .prepare(
                'INSERT INTO content_assets(id,content_id,asset_id) VALUES(?,?,?)',
              )
              .bind(id + ':' + asset, id, asset),
          ),
        ];
        target = id;
        result.id = id;
      } else if (input.action === 'deleteContent') {
        if (
          await db
            .prepare(
              "SELECT id FROM navigation_items WHERE json_extract(data,'$.targetId')=? LIMIT 1",
            )
            .bind(target)
            .first()
        )
          throw Error('内容被导航引用，请先调整导航');
        statements = [
          db
            .prepare(
              "DELETE FROM contents WHERE id=? AND NOT EXISTS(SELECT 1 FROM navigation_items WHERE json_extract(data,'$.targetId')=?)",
            )
            .bind(target, target),
          db
            .prepare('DELETE FROM content_assets WHERE content_id=?')
            .bind(target),
        ];
      } else if (input.action === 'saveFooter') {
        const footer = validateFooter(input.data),
          old = await siteSettings();
        for (const id of [
          footer.logoId,
          ...footer.socials.map((s: any) => s.imageId),
        ].filter(Boolean)) {
          const asset = await db
            .prepare('SELECT mime FROM assets WHERE id=?')
            .bind(id)
            .first<any>();
          if (!asset?.mime.startsWith('image/'))
            throw Error('页脚素材必须为素材库中的图片');
        }
        for (const id of footer.navIds)
          if (
            !(await db
              .prepare('SELECT id FROM navigation_items WHERE id=?')
              .bind(id)
              .first())
          )
            throw Error('所选导航不存在');
        statements = [
          db
            .prepare(
              "INSERT INTO settings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=json_set(settings.data,'$.footer',json_extract(excluded.data,'$.footer'))",
            )
            .bind('site', JSON.stringify({ ...old, footer })),
        ];
        target = 'footer';
      } else if (input.action === 'saveBrand') {
        const brand = validateBrand(input.data);
        for (const key of ['logoId','faviconId'] as const) {
          if (!brand[key]) continue;
          const asset = await db.prepare('SELECT mime FROM assets WHERE id=?').bind(brand[key]).first<any>();
          if (!asset || !(key==='faviconId'?['image/png']:['image/png','image/webp']).includes(asset.mime)) throw Error(key==='faviconId'?'浏览器图标需要 PNG 图片':'Logo 需要 PNG 或 WebP 图片');
        }
        if(brand.faviconId){
          const blob=await env.FILES?.get(brand.faviconId);
          if(!blob)throw Error('图标文件不存在');
          const bytes=await blob.arrayBuffer();
          if(bytes.byteLength<24)throw Error('图标图片格式无效');
          const view=new DataView(bytes),width=view.getUint32(16),height=view.getUint32(20);
          if(!width||width!==height)throw Error('浏览器图标需要正方形 PNG 图片');
        }
        statements = [db.prepare("INSERT INTO settings(id,data) VALUES('site',?) ON CONFLICT(id) DO UPDATE SET data=json_patch(settings.data,excluded.data)").bind(JSON.stringify({brand}))];
        target='brand';
      } else if (input.action === 'saveSettings') {
        const data = validateSettings(input.data);
        statements = [
          db
            .prepare(
              'INSERT INTO settings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=json_patch(settings.data,excluded.data)',
            )
            .bind('site', JSON.stringify(data)),
        ];
        target = 'site';
      } else if (input.action === 'updateSubmission') {
        const checked = workflowInput(input.data);
        if (
          !(await db
            .prepare('SELECT id FROM submissions WHERE id=?')
            .bind(target)
            .first())
        )
          throw Error('提交不存在');
        statements = [
          db
            .prepare(
              'INSERT INTO submission_workflows(id,status,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at',
            )
            .bind(target, checked.status, now),
          db
            .prepare(
              'INSERT INTO submission_history(id,submission_id,actor,status,note,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              target,
              user.email,
              checked.status,
              checked.note,
              now,
            ),
        ];
      } else if (input.action === 'markSubmission')
        statements = [
          db
            .prepare('UPDATE submissions SET status=? WHERE id=?')
            .bind('read', target),
        ];
      else if (input.action === 'addEvidence') {
        const data = {
          engine: text(input.data.engine, 80, true),
          query: text(input.data.query, 500, true),
          url: validateUrl(input.data.url),
          note: text(input.data.note, 3000, true),
        };
        if (!data.url) throw Error('请填写证据链接');
        target = crypto.randomUUID();
        statements = [
          db
            .prepare('INSERT INTO evidence(id,data,created_at) VALUES(?,?,?)')
            .bind(target, JSON.stringify(data), now),
        ];
      } else ({ statements, target, result } = await cmsAction(input));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, (e as Error).message);
    }
    statements.push(
      db
        .prepare(
          'INSERT INTO audit_logs(id,actor,action,target,created_at) VALUES(?,?,?,?,?)',
        )
        .bind(crypto.randomUUID(), user.email, input.action, target, now),
    );
    const changes = await db.batch(statements);
    if (input.action === 'deleteAsset') {
      if (!changes[0].meta.changes)
        throw new HttpError(409, '素材仍被引用，请刷新后重试');
      try {
        await env.FILES?.delete(target);
      } catch {
        result.warning = '素材已移除，存储文件清理暂未完成';
      }
    }
    return Response.json(result);
  } catch (e) {
    return fail(e);
  }
}
