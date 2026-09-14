import { identity, visitorSession } from '@/lib/identity';
import {
  csrf,
  fail,
  HttpError,
  jsonBody,
  database,
  limited,
} from '@/lib/server';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params;
    if (action !== 'status') throw new HttpError(404, '未知操作');
    const result = await identity('social-status');
    result.sandboxAvailable = false;
    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
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
    if (action !== 'oauth-start')
      throw new HttpError(404, '未知操作');
    await limited(
      'oauth:' + (request.headers.get('cf-connecting-ip') || 'local'),
      30,
    );
    const data = await jsonBody(request);
    if (action === 'oauth-start') {
      const { results } = await database()
        .prepare(
          "SELECT kind,version FROM policies WHERE kind IN ('terms','privacy') AND published IS NOT NULL",
        )
        .all<any>();
      if (
        data.consent !== true ||
        results.length !== 2 ||
        !results.every((p) => data[p.kind] === p.version)
      )
        throw new HttpError(400, '请同意最新注册及隐私协议');
    }
    const old = request.headers
      .get('cookie')
      ?.match(/(?:^|;\s*)geo_social=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
    const bytes = crypto.getRandomValues(new Uint8Array(32)),
      generated = btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
    const browser = old || generated;
    const result = await identity('oauth-start', {
      ...data,
      browser,
      session: visitorSession(request),
    });
    const headers = new Headers({ 'Cache-Control': 'no-store' });
    headers.append(
        'Set-Cookie',
        `geo_social=${browser}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
      );
    if (result.session)
      headers.append(
        'Set-Cookie',
        `geo_visitor=${result.session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7200`,
      );
    const { session, ...publicResult } = result;
    return Response.json(publicResult, { headers });
  } catch (e) {
    return fail(e);
  }
}
