import {
  admin,
  csrf,
  jsonBody,
  fail,
  HttpError,
  database,
  limited,
} from '@/lib/server';
import { identity } from '@/lib/identity';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (!['smtp', 'users', 'social','mini'].includes(action))
      throw new HttpError(404, '未知操作');
    const user = await admin(action === 'users' ? 'readUsers' : 'saveSettings');
    return Response.json(
      await identity(
        'admin-' + action,
        action === 'users'
          ? Object.fromEntries(new URL(request.url).searchParams)
          : {},
        user.email,
      ),
      {
        headers: { 'Cache-Control': 'no-store' },
      },
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
    if (
      ![
        'save-smtp',
        'test-smtp',
        'set-user-enabled',
        'save-user-profile',
        'review-user-phone',
        'social-save','mini-save',
      ].includes(action)
    )
      throw new HttpError(404, '未知操作');
    const user = await admin(['set-user-enabled', 'save-user-profile', 'review-user-phone'].includes(action) ? 'manageUsers' : 'saveSettings');
    await limited('identity-admin:' + user.userId, 120);
    const data = await jsonBody(request);
    const result = await identity('admin-' + action, data, user.email);
    let warning = '';
    try {
      await database()
        .prepare(
          'INSERT INTO audit_logs(id,actor,action,target,created_at) VALUES(?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          user.email,
          action,
          action === 'social-save'
            ? String(data.provider)
            : action === 'save-user-profile'
              ? String(data.id)
              : action === 'review-user-phone'
                ? String(data.id) + ':phone-review:' + String(data.status)
                : action === 'set-user-enabled'
                ? String(data.id) +
                  ':' +
                  (data.enabled ? 'enabled' : 'disabled')
                : 'smtp',
          new Date().toISOString(),
        )
        .run();
    } catch {
      warning = '操作已成功，但统一日志写入失败；账号服务保留了操作记录。';
      console.error('Identity audit mirror failed');
    }
    return Response.json(
      { ...result, ...(warning ? { warning } : {}) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
