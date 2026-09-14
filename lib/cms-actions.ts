import { identity } from './identity';
import { database, HttpError } from './server';
import { text } from './domain.mjs';
import {
  validateCategory,
  validateNav,
  validatePolicy,
} from './cms-domain.mjs';
export async function cmsAction(input: any) {
  const db = database(),
    now = new Date().toISOString(),
    v = input.data || {};
  let statements: any[] = [];
  let target = String(input.id || v.id || v.kind || ''),
    result: any = { ok: true };
  if (input.action === 'saveCategory') {
    const all = (await db.prepare('SELECT * FROM categories').all<any>())
      .results;
    const data = validateCategory(v, all),
      id = data.id || crypto.randomUUID();
    const old = all.find((r) => r.id === id);
    if (old && old.kind !== data.kind) throw Error('已有分类不能改变类型');
    statements = [
      db
        .prepare(
          'INSERT INTO categories(id,kind,parent_id,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,data=excluded.data',
        )
        .bind(id, data.kind, data.parentId || null, JSON.stringify(data)),
    ];
    target = id;
    result.id = id;
  } else if (input.action === 'deleteCategory') {
    const refs = await db
      .prepare(
        "SELECT id FROM contents WHERE json_extract(data,'$.categoryId')=? UNION ALL SELECT id FROM categories WHERE parent_id=? UNION ALL SELECT id FROM navigation_items WHERE json_extract(data,'$.targetId')=? LIMIT 1",
      )
      .bind(target, target, target)
      .first();
    if (refs) throw Error('分类仍被内容、子分类或导航引用，请先移除关联');
    statements = [
      db
        .prepare(
          "DELETE FROM categories WHERE id=? AND NOT EXISTS(SELECT 1 FROM contents WHERE json_extract(data,'$.categoryId')=?) AND NOT EXISTS(SELECT 1 FROM categories WHERE parent_id=?) AND NOT EXISTS(SELECT 1 FROM navigation_items WHERE json_extract(data,'$.targetId')=?)",
        )
        .bind(target, target, target, target),
    ];
  } else if (input.action === 'saveFolder') {
    const id = text(v.id, 80) || crypto.randomUUID(),
      name = text(v.name, 80, true);
    statements = [
      db
        .prepare(
          'INSERT INTO asset_folders(id,name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name',
        )
        .bind(id, name),
    ];
    target = id;
    result.id = id;
  } else if (input.action === 'deleteFolder') {
    statements = [
      db
        .prepare('DELETE FROM asset_folders_map WHERE folder_id=?')
        .bind(target),
      db.prepare('DELETE FROM asset_folders WHERE id=?').bind(target),
    ];
  } else if (input.action === 'renameAsset') {
    if (
      !(await db
        .prepare('SELECT id FROM assets WHERE id=?')
        .bind(target)
        .first())
    )
      throw Error('素材不存在');
    statements = [
      db
        .prepare('UPDATE assets SET name=? WHERE id=?')
        .bind(text(v.name, 200, true), target),
    ];
  } else if (input.action === 'deleteAsset') {
    if(await db.prepare("SELECT id FROM settings WHERE id='channels' AND EXISTS(SELECT 1 FROM json_tree(settings.data) WHERE value=?)").bind(target).first()) throw Error('素材被小程序或悬浮入口配置引用，请先移除引用');
    if(await db.prepare('SELECT id FROM marketing_assets WHERE asset_id=? LIMIT 1').bind(target).first()) throw Error('素材被营销活动引用，请先移除活动引用');
    const guard =
      "NOT EXISTS(SELECT 1 FROM content_assets WHERE asset_id=?) AND NOT EXISTS(SELECT 1 FROM contents WHERE json_extract(data,'$.imageId')=? OR EXISTS(SELECT 1 FROM json_each(contents.data,'$.imageIds') WHERE value=?)) AND NOT EXISTS(SELECT 1 FROM settings WHERE json_extract(data,'$.footer.logoId')=? OR json_extract(data,'$.brand.logoId')=? OR json_extract(data,'$.brand.faviconId')=? OR EXISTS(SELECT 1 FROM json_each(settings.data,'$.footer.socials') WHERE json_extract(value,'$.imageId')=?)) AND NOT EXISTS(SELECT 1 FROM settings WHERE id='channels' AND EXISTS(SELECT 1 FROM json_tree(settings.data) WHERE value=?))";
    if (
      !(await db
        .prepare('SELECT id FROM assets WHERE id=?')
        .bind(target)
        .first())
    )
      throw Error('素材不存在');
    const refs = await db
      .prepare('SELECT id FROM assets WHERE id=? AND ' + guard)
      .bind(target, target, target, target, target, target, target, target, target)
      .first();
    if (!refs) {
      const usages = (
        await db
          .prepare(
            "SELECT json_extract(data,'$.titleZh') AS title FROM contents WHERE json_extract(data,'$.imageId')=? OR id IN(SELECT content_id FROM content_assets WHERE asset_id=?) LIMIT 5",
          )
          .bind(target, target)
          .all<any>()
      ).results;
      throw Error(
        '素材正在使用：' +
          (usages.length
            ? usages.map((r) => r.title).join('、')
            : '网站设置 → 页脚 / 品牌与图标') +
          '；请先移除引用',
      );
    }
    // Keep blob inaccessible after metadata deletion. No cross-store destructive race.
    statements = [
      db
        .prepare('DELETE FROM assets WHERE id=? AND ' + guard)
        .bind(target, target, target, target, target, target, target, target, target),
      db
        .prepare(
          'DELETE FROM asset_folders_map WHERE asset_id=? AND NOT EXISTS(SELECT 1 FROM assets WHERE id=?)',
        )
        .bind(target, target),
    ];
  } else if (input.action === 'moveAsset') {
    if (
      !(await db
        .prepare('SELECT id FROM assets WHERE id=?')
        .bind(target)
        .first())
    )
      throw Error('素材不存在');
    if (
      v.folderId &&
      !(await db
        .prepare('SELECT id FROM asset_folders WHERE id=?')
        .bind(v.folderId)
        .first())
    )
      throw Error('文件夹不存在');
    statements = v.folderId
      ? [
          db
            .prepare(
              'INSERT INTO asset_folders_map(asset_id,folder_id) VALUES(?,?) ON CONFLICT(asset_id) DO UPDATE SET folder_id=excluded.folder_id',
            )
            .bind(target, v.folderId),
        ]
      : [
          db
            .prepare('DELETE FROM asset_folders_map WHERE asset_id=?')
            .bind(target),
        ];
  } else if (input.action === 'saveNav') {
    const data = validateNav(v),
      id = data.id || crypto.randomUUID();
    const category = data.targetType.endsWith('Category'),
      kind = category
        ? data.targetType === 'articleCategory'
          ? 'articles'
          : 'products'
        : { article: 'articles', product: 'products', form: 'forms' }[
            data.targetType as 'article'
          ];
    const exists = data.targetType==='pointsMall' ? data.targetId==='points-shop' : data.targetType==='videoCatalog' ? data.targetId==='videos' : data.targetType==='event' ? (await identity('marketing-detail',{id:data.targetId})).event : category
      ? await db
          .prepare('SELECT id FROM categories WHERE id=? AND kind=?')
          .bind(data.targetId, kind)
          .first()
      : await db
          .prepare('SELECT id FROM contents WHERE id=? AND kind=?')
          .bind(data.targetId, kind)
          .first();
    if (!exists) throw Error('关联目标不存在或类型不符');
    statements = [
      db
        .prepare(
          'INSERT INTO navigation_items(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
        )
        .bind(id, JSON.stringify(data)),
    ];
    target = id;
    result.id = id;
  } else if (input.action === 'deleteNav')
    statements = [
      db.prepare('DELETE FROM navigation_items WHERE id=?').bind(target),
    ];
  else if (input.action === 'saveAdmin') {
    throw Error('请使用管理员账号管理页面');
  } else if (input.action === 'savePolicy') {
    const data = validatePolicy(v);
    statements = [
      db
        .prepare(
          'INSERT INTO policies(kind,data,published,version,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET data=excluded.data,published=CASE WHEN excluded.published IS NOT NULL THEN excluded.published ELSE policies.published END,version=policies.version+CASE WHEN excluded.published IS NOT NULL THEN 1 ELSE 0 END,updated_at=excluded.updated_at',
        )
        .bind(
          data.kind,
          JSON.stringify(data),
          data.status === 'published' ? JSON.stringify(data) : null,
          data.status === 'published' ? 1 : 0,
          now,
        ),
    ];
    target = data.kind;
  } else throw new HttpError(400, '未知操作');
  return { statements, target, result };
}
