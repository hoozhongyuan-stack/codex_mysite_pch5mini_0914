import { syncOrderPoints } from '@/lib/order-points';
import { admin, csrf, jsonBody, fail, HttpError, limited, database } from '@/lib/server';
import { identity, visitorSession } from '@/lib/identity';
function staff(request: Request) {
  return request.headers.get('cookie')?.match(/(?:^|;\s*)geo_staff=([\w-]{43})(?:;|$)/)?.[1] || '';
}
export async function GET(request: Request, { params }: any) {
  try {
    const { action } = await params;
    if (!['rules', 'summary', 'state', 'favorites', 'accounts', 'ledger'].includes(action)) throw new HttpError(404, '未知操作');
    const isAdmin = ['rules', 'accounts', 'ledger'].includes(action);
    if (isAdmin) await admin('saveSettings');
    const data = isAdmin ? { ...Object.fromEntries(new URL(request.url).searchParams), _staff: staff(request) } : {
      kind: new URL(request.url).searchParams.get('kind') || '', id: new URL(request.url).searchParams.get('id') || '', session: visitorSession(request), page: new URL(request.url).searchParams.get('page') || 1,
    };
    return Response.json(await identity(isAdmin ? 'admin-points-' + action : 'points-' + action, data),
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return fail(e); }
}
export async function POST(request: Request, { params }: any) {
  try {
    csrf(request);
    const { action } = await params;
    if (action === 'interact') {
      const input = await jsonBody(request);
      const session = visitorSession(request);
      if (!session) throw new HttpError(401, '请先登录 / Please sign in');
      await limited('points-interact:' + session, 100);
      let title = '', path = '';
      if (['article', 'product'].includes(input.kind)) {
        const kind = input.kind === 'article' ? 'articles' : 'products';
        const row = await database().prepare("SELECT data,slug FROM contents WHERE id=? AND kind=? AND status='published' AND COALESCE(json_extract(data,'$.channels.website'),1)=1").bind(String(input.id), kind).first<any>();
        if (!row) throw new HttpError(404, '内容尚未发布');
        title = JSON.parse(row.data).titleZh || '';
        path = '/zh/' + kind + '/' + row.slug;
      } else if (!['salon', 'video'].includes(input.kind)) throw new HttpError(400, '互动类型无效');
      return Response.json(await identity('points-interact', {kind: input.kind, id: input.id, action: input.action, active: input.active, session, _title: title, _path: path}));
    }
    const user = await admin('saveSettings');
    await limited('points-admin:' + user.userId, 100);
    if (action === 'retry-orders') {
      const rows = (await database().prepare("SELECT id FROM orders WHERE json_extract(data,'$.pointsPending')=1 ORDER BY updated_at LIMIT 100").all<any>()).results;
      let failed = 0;
      for (const row of rows) { try { await syncOrderPoints(row.id); } catch { failed += 1; } }
      return Response.json({ok:true, count:rows.length-failed, failed});
    }
    if (action === 'retry-forms') {
      const rows = (await database().prepare("SELECT id,data FROM submissions WHERE json_extract(data,'$._points.status') IN ('pending','failed') ORDER BY CASE json_extract(data,'$._points.status') WHEN 'pending' THEN 0 ELSE 1 END,created_at,id LIMIT 100").all<any>()).results;
      let failed = 0;
      for (const row of rows) {
        try {
        const receipt = JSON.parse(row.data)._points;
        await identity('points-form', {userId: receipt.userId, id: row.id, at: receipt.at});
        await database().prepare("UPDATE submissions SET data=json_set(data,'$._points.status','done') WHERE id=?").bind(row.id).run();
        } catch {
          failed += 1;
          await database().prepare("UPDATE submissions SET data=json_set(data,'$._points.status','failed') WHERE id=?").bind(row.id).run();
        }
      }
      return Response.json({ok: true, count: rows.length - failed, failed});
    }
    if (!['save-rule', 'adjust'].includes(action)) throw new HttpError(404, '未知操作');
    await limited('points-admin:' + user.userId, 100);
    const data = await jsonBody(request);
    return Response.json(await identity('admin-points-' + action, { ...data, _staff: staff(request) }),
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return fail(e); }
}
