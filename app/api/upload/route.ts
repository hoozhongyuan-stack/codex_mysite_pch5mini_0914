import { env } from 'cloudflare:workers';
import {
  admin,
  csrf,
  database,
  fail,
  HttpError,
  limited,
  boundedResponse,
} from '@/lib/server';
import { validMedia } from '@/lib/domain.mjs';
export async function POST(request: Request) {
  try {
    const user = await admin('upload');
    csrf(request);
    await limited('upload:' + user.userId, 15);
    if (Number(request.headers.get('content-length')) > 32 * 1024 * 1024)
      throw new HttpError(413, '单个文件不能超过 30 MB');
    const form = await boundedResponse(request, 31 * 1024 * 1024).formData();
    const file = form.get('file');
    if (!(file instanceof File) || !validMedia(file.type, file.size))
      throw new HttpError(
        400,
        '仅支持 JPG、PNG、WebP、GIF、MP4、WebM，最大 30 MB',
      );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const magic = Array.from(bytes.slice(0, 12));
    const detected =
      (file.type === 'image/png' &&
        magic.slice(0, 8).join() === '137,80,78,71,13,10,26,10') ||
      (file.type === 'image/jpeg' &&
        magic[0] === 255 &&
        magic[1] === 216 &&
        magic[2] === 255) ||
      (file.type === 'image/gif' &&
        new TextDecoder().decode(bytes.slice(0, 6)).match(/^GIF8[79]a$/)) ||
      (file.type === 'image/webp' &&
        new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
        new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') ||
      (file.type === 'video/mp4' &&
        new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp') ||
      (file.type === 'video/webm' &&
        magic.slice(0, 4).join() === '26,69,223,163');
    if (!detected) throw new HttpError(400, '文件格式与内容不匹配');
    const id = crypto.randomUUID();
    if (!env.FILES) throw new HttpError(503, '素材存储尚未配置');
    await env.FILES.put(id, bytes, {
      httpMetadata: { contentType: file.type },
    });
    try {
      const db = database();
      await db.batch([
        db
          .prepare(
            'INSERT INTO assets(id,name,mime,size,created_at) VALUES(?,?,?,?,?)',
          )
          .bind(
            id,
            file.name.slice(0, 200),
            file.type,
            file.size,
            new Date().toISOString(),
          ),
        db
          .prepare(
            'INSERT INTO audit_logs(id,actor,action,target,created_at) VALUES(?,?,?,?,?)',
          )
          .bind(
            crypto.randomUUID(),
            user.email,
            'upload',
            id,
            new Date().toISOString(),
          ),
      ]);
    } catch (e) {
      await env.FILES.delete(id);
      throw e;
    }
    return Response.json({ id });
  } catch (e) {
    return fail(e);
  }
}
