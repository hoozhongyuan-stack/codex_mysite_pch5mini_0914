import { identity } from './identity';
import { channelVisible } from './content-channels.mjs';
import { database } from './server';
import {
  validateMini,
  detailTargetKinds,
  validateFloating,
  channelAssetIds,
} from './channel-config.mjs';
export async function channelState() {
  const row = await database()
    .prepare("SELECT data FROM settings WHERE id='channels'")
    .first<any>();
  return row
    ? JSON.parse(row.data)
    : {
        revision: '',
        draft: { mini: validateMini(), floating: [] },
        published: null,
        previous: null,
      };
}
export async function checkChannelConfig(value: any, draft = false) {
  const mini = validateMini(value?.mini, {draft}),
    floating = validateFloating(value?.floating);
  const db = database();
  for (const id of channelAssetIds(mini, floating)) {
    const a = await db
      .prepare('SELECT mime FROM assets WHERE id=?')
      .bind(id)
      .first<any>();
    if (!a?.mime.startsWith('image/')) throw Error('请选择素材库中的有效图片');
  }
  for (const e of floating.filter((e) => e.kind === 'form'))
    if (
      !(await db
        .prepare(
          "SELECT id FROM contents WHERE id=? AND kind='forms' AND status='published'",
        )
        .bind(e.formId)
        .first())
    )
      throw Error('关联表单必须已发布');
  const componentLinks = (components: any[] = []) =>
    components.flatMap((component) =>
      component.type === 'banners'
        ? component.items || []
        : component.type === 'hotspots'
          ? (component.items || []).flatMap((item: any) => item.zones || [])
          : [component],
    );
  const componentProductIds = (components: any[] = []) =>
    components.flatMap((component) =>
      component.type === 'productFloor' ? component.productIds || [] : [],
    );
  for (const entry of [
    ...mini.banners,
    ...mini.hotspotImages.flatMap((b: any) => b.zones),
    ...componentLinks(mini.homeComponents),
    ...mini.microPages.flatMap((page: any) => componentLinks(page.components)),
  ]) {
    if (draft || !entry.contentId) continue;
    if (entry.target === 'microPage') continue;
    if (entry.target === 'video' || entry.target === 'event') {
      try { const result = await identity(entry.target === 'video' ? 'video-detail' : 'marketing-detail', {id:entry.contentId});
        if (entry.target==='event' && !['published','closed'].includes(result.event?.status)) throw Error('活动不可用');
      }
      catch { throw Error('关联视频或沙龙会不可访问，请选择已发布内容'); }
      continue;
    }
    const kind = (detailTargetKinds as Record<string,string>)[entry.target];
    if (!kind) continue;
    const row = await db.prepare("SELECT data,status FROM contents WHERE id=? AND kind=? AND status='published'").bind(entry.contentId,kind).first<any>();
    if (!row || !channelVisible({...JSON.parse(row.data),status:row.status},'mini')) throw Error('关联内容必须已发布且开启小程序渠道');
  }
  for (const id of [
    ...mini.featuredIds,
    ...componentProductIds(mini.homeComponents),
    ...mini.microPages.flatMap((page: any) => componentProductIds(page.components)),
  ])
    if (
      !(await db
        .prepare(
          "SELECT id FROM contents WHERE id=? AND kind='products' AND status='published'",
        )
        .bind(id)
        .first())
    )
      throw Error('首页推荐商品必须已发布');
  return { mini, floating };
}
export async function resolvedFloating(
  entries: any[],
  end: string,
  lang: string,
) {
  const db = database();
  const privacy = await db
    .prepare(
      "SELECT version FROM policies WHERE kind='privacy' AND published IS NOT NULL",
    )
    .first<any>();
  const result = await Promise.all(
    entries
      .filter((e) => e.enabled && e.ends.includes(end))
      .slice(0, 3)
      .map(async (e) => {
        for (const id of [e.iconId, e.imageId].filter(Boolean))
          if (
            !(await db
              .prepare('SELECT id FROM assets WHERE id=?')
              .bind(id)
              .first())
          )
            return null;

        if (e.kind !== 'form')
          return {
            ...e,
            imageUrl: e.imageId ? '/api/media/' + e.imageId : '',
            iconUrl: e.iconId ? '/api/media/' + e.iconId : '',
          };
        const row = await db
          .prepare(
            "SELECT slug,data,updated_at FROM contents WHERE id=? AND kind='forms' AND status='published'",
          )
          .bind(e.formId)
          .first<any>();
        if (!row) return null;
        const f = JSON.parse(row.data);
        if (
          !channelVisible(
            { ...f, status: 'published' },
            end === 'mini' ? 'mini' : 'website',
          )
        )
          return null;
        return {
          ...e,
          iconUrl: e.iconId ? '/api/media/' + e.iconId : '',
          formHref: `/${lang}/forms/${row.slug}`,
          form: {
            fields: f.fields,
            updatedAt: row.updated_at,
            privacyVersion: privacy?.version,
          },
        };
      }),
  );
  return result.filter(Boolean);
}
