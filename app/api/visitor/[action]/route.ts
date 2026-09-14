import {
  csrf,
  jsonBody,
  fail,
  HttpError,
  limited,
  database,
} from '@/lib/server';
import { identity, visitorSession } from '@/lib/identity';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (!['session', 'status'].includes(action))
      throw new HttpError(405, '不支持此请求');
    return Response.json(
      await identity(action, { session: visitorSession(request) }),
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
    if (
      !['register', 'login', 'forgot', 'reset', 'verify', 'logout'].includes(
        action,
      )
    )
      throw new HttpError(404, '未知操作');
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    await limited('visitor:' + ip, 20);
    const data = await jsonBody(request);
    if (action === 'register') {
      const policies = (
        await database()
          .prepare(
            "SELECT kind,version FROM policies WHERE kind IN ('terms','privacy') AND published IS NOT NULL",
          )
          .all<any>()
      ).results;
      if (
        data.consent !== true ||
        policies.length !== 2 ||
        !policies.every((p) => data[p.kind] === p.version)
      )
        throw new HttpError(
          400,
          '请阅读并同意最新注册及隐私协议，若未发布请联系管理员',
        );
    }
    const result = await identity(action, {
      ...data,
      _ip: ip,
      session: visitorSession(request),
    });
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    if (action === 'login' || action === 'logout')
      headers.set(
        'Set-Cookie',
        `geo_visitor=${result.session || ''}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${action === 'logout' ? 0 : 604800}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`,
      );
    const { session: _, ...publicResult } = result;
    return Response.json(publicResult, { headers });
  } catch (e) {
    return fail(e);
  }
}
