import { miniReleaseStatus, runMiniRelease } from '@/lib/mini-release.mjs';
import { admin, csrf, fail, jsonBody, limited } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await admin('manageConfiguration');
    const status = await miniReleaseStatus();
    return Response.json(status, { headers: { 'Cache-Control': 'no-store' } });
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
    const result = await runMiniRelease(input);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return fail(e);
  }
}
