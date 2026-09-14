import {channelPredicate} from '@/lib/mini-business.mjs';
import { identity,visitorSession } from '@/lib/identity';
import { env } from 'cloudflare:workers';
import {
  database,
  csrf,
  boundedResponse,
  limited,
  HttpError,
  fail,
} from '@/lib/server';
export async function POST(request: Request) {return uploadForm(request)}
export async function uploadForm(request:Request,mini?:{user:any}) {
  try {
    if(!mini)csrf(request);
    await limited(
      'formUpload:' + (request.headers.get('cf-connecting-ip') || 'anonymous'),
      10,
    );
    const body = await boundedResponse(request, 6 * 1024 * 1024).formData();
    const formId = String(body.get('formId') || ''),
      fieldId = String(body.get('fieldId') || ''),
      file = body.get('file');
    const eventId=String(body.get('eventId')||'');
    let eventUser:any=null;
    let event:any=null;

    if(eventId){
      eventUser=mini?.user || (await identity('session',{session:visitorSession(request)})).user;
      if(!eventUser)throw new HttpError(401,'请先登录');
      event=(await identity('marketing-detail',{id:eventId})).event;
    }
    const form = event ? {data:JSON.stringify(event)} : await database()
      .prepare(
        `SELECT data FROM contents WHERE id=? AND kind='forms' AND status='published' AND ${channelPredicate(mini?'mini':'website')}`,
      )
      .bind(formId)
      .first<any>();
    if (
      !form ||
      !JSON.parse(form.data).fields?.some(
        (f: any) => f.id === fieldId && f.type === 'image',
      )
    )
      throw new HttpError(400, '图片项目未开放');
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      file.size === 0 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      throw new HttpError(400, '仅支持5MB以内的 JPG、PNG、WebP');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ok =
      (file.type === 'image/png' &&
        Array.from(bytes.slice(0, 8)).join() === '137,80,78,71,13,10,26,10') ||
      (file.type === 'image/jpeg' &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255) ||
      (file.type === 'image/webp' &&
        new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
        new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP');
    if (!ok) throw new HttpError(400, '图片内容与格式不符');
    const current = request.headers
      .get('cookie')
      ?.match(/(?:^|;\s*)form_upload_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
    const session = mini ? "mini:"+mini.user.id : eventUser ? 'visitor:'+eventUser.id : current || crypto.randomUUID(),
      id = crypto.randomUUID();
    if (!env.FILES) throw new HttpError(503, '存储服务尚未配置');
    await env.FILES.put('form/' + id, bytes, {
      httpMetadata: { contentType: file.type },
    });
    try {
      await database()
        .prepare(
          'INSERT INTO submission_files(id,form_id,field_id,session,name,mime,created_at) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          eventId ? 'event:'+eventId : formId,
          fieldId,
          session,
          file.name.slice(0, 200),
          file.type,
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      await env.FILES.delete('form/' + id);
      throw e;
    }
    return Response.json(
      { id, name: file.name },
      {
        headers: {
          ...((eventId||mini)?{}:{'Set-Cookie': `form_upload_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`}),
        },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
