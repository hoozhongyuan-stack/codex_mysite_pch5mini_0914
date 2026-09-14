import { env } from 'cloudflare:workers';
import {
  csrf,
  boundedResponse,
  database,
  HttpError,
  fail,
  limited,
} from '@/lib/server';
import { buyer, orderAdmin, orderDetail } from '@/lib/orders';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = await database()
      .prepare('SELECT * FROM order_files WHERE id=?')
      .bind(id)
      .first<any>();
    if (!row) throw new HttpError(404, '文件不存在');
    let own = false;
    try {
      const u = await buyer(request);
      await orderDetail(row.order_id, String(u.id));
      own = true;
    } catch {}
    if (!own) await orderAdmin('view');
    const object = await env.FILES?.get('orders/' + id);
    if (!object) throw new HttpError(404, '文件不存在');
    return new Response(object.body, {
      headers: {
        'Content-Type': row.mime,
        'Cache-Control': 'private,no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){return uploadOrderFile(request,context)}
export async function uploadOrderFile(request:Request,{params}:{params:Promise<{id:string}>},mini?:{user:any}) {
  try {
    if(!mini)csrf(request);
    const { id } = await params;
    const form = await boundedResponse(request, 6 * 1024 * 1024).formData(),
      purpose = String(form.get('purpose') || 'payment');
    let actor: string, order: any;
    if(mini&&purpose!=='payment')throw new HttpError(400,'只支持付款凭证');
    if (purpose === 'refund') {
      const u = await orderAdmin('aftersale');
      actor = u.email;
      order = await orderDetail(id);
      if (order.status !== 'aftersale')
        throw new HttpError(400, '当前不可上传退款凭证');
    } else {
      const u = mini?.user || await buyer(request);
      actor = String(u.id);
      order = await orderDetail(id, actor);
      if (
        !['payment', 'aftersale'].includes(purpose) ||
        (purpose === 'payment' && order.status !== 'pending_payment')
      )
        throw new HttpError(400, '当前不可上传');
    }
    await limited('order-upload:' + actor, 30);
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 5 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
    )
      throw new HttpError(400, '图片限5MB以内 JPG/PNG/WebP');
    const b = new Uint8Array(await file.arrayBuffer()),
      ok =
        file.type === 'image/png'
          ? b.slice(0, 8).join() === '137,80,78,71,13,10,26,10'
          : file.type === 'image/jpeg'
            ? b[0] === 255 && b[1] === 216 && b[2] === 255
            : new TextDecoder().decode(b.slice(0, 4)) === 'RIFF' &&
              new TextDecoder().decode(b.slice(8, 12)) === 'WEBP';
    if (!ok) throw new HttpError(400, '图片格式无效');
    if (!env.FILES) throw new HttpError(503, '文件存储未配置');
    const fileId = crypto.randomUUID();
    await env.FILES.put('orders/' + fileId, b, {
      httpMetadata: { contentType: file.type },
    });
    try {
      await database()
        .prepare('INSERT INTO order_files VALUES(?,?,?,?,?,?,?)')
        .bind(
          fileId,
          id,
          actor,
          purpose,
          file.type,
          file.name.slice(0, 200),
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      await env.FILES.delete('orders/' + fileId);
      throw e;
    }
    return Response.json(
      { id: fileId },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
