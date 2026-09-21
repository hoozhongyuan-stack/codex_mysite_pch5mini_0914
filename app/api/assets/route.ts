import { admin, database, fail, HttpError } from '@/lib/server';
export async function GET(request: Request) {
  try {
    await admin('readAssets');
    const p = new URL(request.url).searchParams,
      type = p.get('type') || 'image',
      folder = p.get('folder') || 'all',
      q = (p.get('q') || '').trim(),
      page = Number(p.get('page') || 1);
    if (
      !['image', 'video', 'all'].includes(type) ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 1000000 ||
      q.length > 200
    )
      throw new HttpError(400, '筛选参数无效');
    const db = database(),
      where = ['1=1'],
      args: any[] = [];
    if (type !== 'all') {
      where.push('a.mime LIKE ?');
      args.push(type + '/%');
    }
    if (folder === 'none') where.push('m.folder_id IS NULL');
    else if (folder !== 'all') {
      where.push('m.folder_id=?');
      args.push(folder);
    }
    if (q) {
      where.push('instr(lower(a.name),lower(?))>0');
      args.push(q);
    }
    const from =
        ' FROM assets a LEFT JOIN asset_folders_map m ON a.id=m.asset_id WHERE ' +
        where.join(' AND '),
      total = (
        await db
          .prepare('SELECT COUNT(*) AS n' + from)
          .bind(...args)
          .first<any>()
      ).n,
      pages = Math.max(1, Math.ceil(total / 20)),
      current = Math.min(page, pages);
    let rows: any[];
    try {
      rows = (
        await db
          .prepare(
            "SELECT a.*,m.folder_id,(SELECT COUNT(*) FROM asset_variants v WHERE v.asset_id=a.id AND v.status='ready') AS derivative_count" +
              from +
              ' ORDER BY a.created_at DESC,a.id DESC LIMIT 20 OFFSET ?',
          )
          .bind(...args, (current - 1) * 20)
          .all()
      ).results as any[];
    } catch (error) {
      // The schema change is additive. A brief migration gap must not block
      // material management or make uploaded originals disappear.
      if (!/asset_variants|no such table|does not exist/i.test(String(error))) throw error;
      rows = (
        await db
          .prepare('SELECT a.*,m.folder_id' + from + ' ORDER BY a.created_at DESC,a.id DESC LIMIT 20 OFFSET ?')
          .bind(...args, (current - 1) * 20)
          .all()
      ).results.map((row: any) => ({...row, derivative_count: 0}));
    }
    const folders = (
      await db
        .prepare(
          "SELECT f.*, (SELECT COUNT(*) FROM asset_folders_map m JOIN assets a ON a.id=m.asset_id WHERE m.folder_id=f.id AND (?='all' OR a.mime LIKE ?)) AS count FROM asset_folders f ORDER BY f.name",
        )
        .bind(type, type + '/%')
        .all()
    ).results;
    const counts = await db
      .prepare(
        "SELECT COUNT(*) AS total,SUM(CASE WHEN m.folder_id IS NULL THEN 1 ELSE 0 END) AS ungrouped FROM assets a LEFT JOIN asset_folders_map m ON a.id=m.asset_id WHERE ?='all' OR a.mime LIKE ?",
      )
      .bind(type, type + '/%')
      .first();
    return Response.json(
      { rows, folders, counts, total, pages, page: current },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
