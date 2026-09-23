import { saveMiniReleaseKey } from '@/lib/mini-release.mjs';
import { admin, boundedResponse, csrf, fail, HttpError, limited } from '@/lib/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    csrf(request);
    const user = await admin('manageConfiguration');
    if (user.role !== 'owner') throw new HttpError(403, '只有站点所有者可以更换代码上传密钥');
    await limited('mini-release-key:' + user.userId, 4);
    if (!request.headers.get('content-type')?.includes('multipart/form-data')) throw new HttpError(415, '请选择微信代码上传密钥文件');
    const form = await boundedResponse(request, 36 * 1024).formData();
    const file = form.get('key');
    if (!(file instanceof File)) throw new HttpError(400, '请选择微信代码上传密钥文件');
    await saveMiniReleaseKey(Buffer.from(await file.arrayBuffer()));
    return Response.json({ configured: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return fail(error);
  }
}
