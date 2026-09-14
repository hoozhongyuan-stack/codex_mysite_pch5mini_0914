import { headers } from 'next/headers';
import { identity } from '@/lib/identity';
import { csrf, jsonBody, fail, HttpError, limited, admin } from '@/lib/server';
export async function POST(request: Request, { params }: any) {
  try {
    csrf(request);
    const { action } = await params;
    if (!['login', 'logout', 'profile', 'list', 'save', 'activity', 'permissions-list', 'permissions-save', 'permissions-assign', 'permissions-legacy-marketing', 'permissions-legacy-orders'].includes(action))
      throw new HttpError(404, '未知操作');
    const data = await jsonBody(request);
    if (action.startsWith('permissions-')) {
      const user = await admin();
      if (user.role !== 'owner') throw new HttpError(403, '仅超级管理员可管理权限组');
      await limited('permissions:' + user.userId, 100);
      if (action === 'permissions-legacy-orders') {
        const { saveLegacyOrders } = await import('@/lib/permission-store');
        return Response.json(await saveLegacyOrders(data, user.email), { headers: { 'Cache-Control': 'no-store' } });
      }
    }
    const session =
      request.headers
        .get('cookie')
        ?.match(/(?:^|;\s*)geo_staff=([\w-]{43})(?:;|$)/)?.[1] || '';
    if(action==='activity') {
      const user=await admin();
      if(user.role!=='owner')throw new HttpError(403,'仅超级管理员可查看操作日志');
      await limited('staff-activity:'+user.userId,100);
      const {activityQuery}=await import('@/lib/staff-activity.mjs');
      const {cmsActivity}=await import('@/lib/staff-activity-store');
      let query;
      try { query=activityQuery(data); }
      catch (error) { throw new HttpError(400, (error as Error).message); }
      const [cms,account]=await Promise.all([cmsActivity(query),identity('staff-activity',{...query,limit:query.page*query.size,session})]);
      const rows=[...cms.rows,...account.rows].sort((a:any,b:any)=>new Date(b.created).getTime()-new Date(a.created).getTime()||b.id.localeCompare(a.id));
      return Response.json({rows:rows.slice((query.page-1)*query.size,query.page*query.size),total:cms.total+account.total,page:query.page,size:query.size},{headers:{'Cache-Control':'no-store'}});
    }
    const result = await identity('staff-' + action, {
      ...data,
      session,
      _ip: request.headers.get('cf-connecting-ip') || 'local',
    });
    const h = new Headers({ 'Cache-Control': 'no-store' });
    if (result.session || ['logout', 'profile'].includes(action))
      h.set(
        'Set-Cookie',
        `geo_staff=${result.session || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${result.session ? 28800 : 0}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
      );
    if (action === 'permissions-list') {
      const { commerceConfig } = await import('@/lib/orders');
      result.legacyOrders = (await commerceConfig()).grants || {};
      result.members = result.members.map((member:any)=>({...member,effectivePermissions:member.active&&!member.mustChange?[...new Set([...(member.effectivePermissions||[]),...(result.legacyOrders[member.email.toLowerCase()]||[]).map((permission:string)=>'orders.'+permission)])]:[]}));
      const { orderPermissionLogs } = await import('@/lib/permission-store');
      result.logs = [...result.logs, ...await orderPermissionLogs()].sort((a: any, b: any) => new Date(b.created).getTime() - new Date(a.created).getTime()).slice(0, 200);
    }
    const { session: _, ...safe } = result;
    return Response.json(safe, { headers: h });
  } catch (e) {
    return fail(e);
  }
}
