import { admin, csrf, jsonBody, fail, HttpError, limited } from '@/lib/server';
import { identity, visitorSession } from '@/lib/identity';
import { marketingAccess } from '@/lib/marketing-access';
import { database } from '@/lib/server';
import { validateRich, richAssets } from '@/lib/cms-domain.mjs';
import { allowsFormalEventSave } from '@/lib/marketing-mode.mjs';
import { notifyEvent } from '@/lib/notification-center.mjs';
const readAdmin = ['list', 'detail', 'registrations', 'grants', 'access','qr'];
const writeAdmin = [
  'save',
  'batch-events',
  'change-registration',
  'export',
  'retry-mail',
  'save-grant',
];
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    const data = Object.fromEntries(new URL(request.url).searchParams);
    if (action.startsWith('admin-')) {
      const a = action.slice(6);
      if (!readAdmin.includes(a)) throw new HttpError(404, '未知操作');
      const user =
        a === 'grants' ? await admin('saveSettings') : await marketingAccess();
      return Response.json(
        await identity('admin-marketing-' + a, data, user.email),
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (!['list', 'detail', 'mine', 'registration'].includes(action))
      throw new HttpError(404, '未知操作');
    return Response.json(
      await identity('marketing-' + action, {
        ...data,
        session: visitorSession(request),
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    csrf(request);
    const { action } = await params;
    const data = await jsonBody(request);
    if (action.startsWith('admin-')) {
      const a = action.slice(6);
      if (!writeAdmin.includes(a)) throw new HttpError(404, '未知操作');
      const user =
        a === 'save-grant'
          ? await admin('saveSettings')
          : await marketingAccess(
              (a === 'export' || (a === 'batch-events' && data.operation === 'export'))
                ? 'export'
                : a === 'change-registration' &&
                    ['checkin', 'undo'].includes(data.operation)
                  ? 'checkin'
                  : 'manage',
            );
      await limited('marketing-admin:' + user.userId, 120);
      if (a === 'save') {
        const existing = data.id
          ? (await identity('admin-marketing-detail', { id: data.id }, user.email)).event
          : null;
        if (!allowsFormalEventSave(data, existing))
          throw new HttpError(400, '模拟活动已停用；历史记录仅可归档或退回草稿。');
      }
      const normalized =
        a === 'save'
          ? {
              ...data,
              bodyZh: validateRich(data.bodyZh || { type: 'doc', content: [] }),
              bodyEn: validateRich(data.bodyEn || { type: 'doc', content: [] }),
            }
          : data;
      if (a === 'save') {
        normalized.create = !normalized.id;
        normalized.id = normalized.id || crypto.randomUUID();
        normalized.assetIds = [
          ...new Set(
            [
              normalized.imageId,
              ...richAssets(normalized.bodyZh),
              ...richAssets(normalized.bodyEn),
            ].filter(Boolean),
          ),
        ];
        // Conservatively reserve references before the cross-store save; failed saves never expose media.
        for (const id of normalized.assetIds) {
          if (
            !(await database()
              .prepare('SELECT id FROM assets WHERE id=?')
              .bind(id)
              .first())
          )
            throw new HttpError(400, '素材不存在');
          await database()
            .prepare(
              'INSERT OR IGNORE INTO marketing_assets(id,event_id,asset_id) VALUES(?,?,?)',
            )
            .bind(normalized.id + ':' + id, normalized.id, id)
            .run();
        }
      }
      const result = await identity('admin-marketing-' + a, normalized, user.email);
      if (a === 'save' && normalized.notify === true && result?.event?.id) {
        let page = 1;
        let pages = 1;
        do {
          const registrations = await identity(
            'admin-marketing-registrations',
            { id: result.event.id, status: 'active', page, pageSize: 100 },
            user.email,
          );
          pages = Number(registrations?.pages || 1);
          for (const row of registrations?.rows || []) {
            if (!row?.userId) continue;
            await notifyEvent('eventChanged', {
              userId: Number(row.userId),
              eventId: result.event.id,
              registrationId: row.id,
              title: result.event.titleZh || result.event.titleEn || '沙龙会通知',
              status: result.event.status === 'cancelled' ? '已取消' : '活动已更新',
              time: result.event.starts,
              location: result.event.locationZh || result.event.addressZh || result.event.locationEn || result.event.addressEn,
            });
          }
          page += 1;
        } while (page <= pages);
      }
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!['register', 'cancel', 'checkin'].includes(action))
      throw new HttpError(404, '未知操作');
    const session = visitorSession(request);
    if (!session) throw new HttpError(401, '请先登录 / Please sign in');
    await limited('marketing:' + session, 60);
    const files: string[] = [];
    if (action === 'register') {
      const user = (await identity('session', { session })).user;
      if (!user) throw new HttpError(401, '请先登录');
      const event = (await identity('marketing-detail', { id: data.id })).event;
      data._eventVersion=event.updated;
      for (const f of event.fields.filter((f: any) => f.type === 'image')) {
        const path = data.answers?.[f.id];
        if (!path) continue;
        if (
          typeof path !== 'string' ||
          !/^\/api\/submission-file\/[a-f0-9-]{36}$/.test(path)
        )
          throw new HttpError(400, '图片无效');
        const id = path.split('/').pop();
        if (
          !(await database()
            .prepare(
              'SELECT id FROM submission_files WHERE id=? AND form_id=? AND field_id=? AND session=?',
            )
            .bind(id, 'event:' + data.id, f.id, 'visitor:' + user.id)
            .first())
        )
          throw new HttpError(403, '图片不属于当前报名');
        files.push(id!);
      }
    }
    const result = await identity('marketing-' + action, { ...data, session });
    for (const id of files)
      await database()
        .prepare('UPDATE submission_files SET submission_id=? WHERE id=?')
        .bind('event:' + result.registration.id, id)
        .run();
    if (action === 'register' && result?.registration?.id) {
      const user = (await identity('session', { session })).user;
      if (user?.id) {
        const event = (await identity('marketing-detail', { id: data.id })).event;
        await notifyEvent('eventRegistered', {
          userId: Number(user.id),
          eventId: data.id,
          registrationId: result.registration.id,
          title: event?.titleZh || event?.titleEn || '沙龙会报名',
          status: '已报名',
          time: event?.starts,
          location: event?.locationZh || event?.addressZh || event?.locationEn || event?.addressEn,
        });
      }
    }
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return fail(e);
  }
}
