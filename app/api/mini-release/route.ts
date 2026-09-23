import { miniReleaseStatus, runMiniRelease } from '@/lib/mini-release.mjs';
import { admin, csrf, fail, jsonBody, limited } from '@/lib/server';
import { identity } from '@/lib/identity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await admin('manageConfiguration');
    const config = await identity('admin-mini', {}, user.email);
    const status = await miniReleaseStatus({
      ...process.env,
      WECHAT_MINI_APPID: config.clientId || process.env.WECHAT_MINI_APPID || '',
      WECHAT_MINI_ACCESS_TOKEN: config.hasSecret ? 'configured' : process.env.WECHAT_MINI_ACCESS_TOKEN || '',
    });
    return Response.json({ ...status, canManageKey: user.role === 'owner' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: Request) {
  try {
    csrf(request);
    const user = await admin('manageConfiguration');
    await limited('mini-release:' + user.userId, 8);
    const input = await jsonBody(request);
    const config = await identity('admin-mini', {}, user.email);
    const releaseEnv: NodeJS.ProcessEnv = { ...process.env, WECHAT_MINI_APPID: config.clientId || process.env.WECHAT_MINI_APPID || '' };
    if (input.action === 'submitAudit') {
      const token = await identity('admin-mini-release-token', {}, user.email);
      releaseEnv.WECHAT_MINI_ACCESS_TOKEN = token.accessToken;
      releaseEnv.WECHAT_MINI_APPID = token.appid;
    }
    const result = await runMiniRelease(input, releaseEnv);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return fail(e);
  }
}
