import { env } from 'cloudflare:workers';
import { buyer, orderAdmin, orderDetail } from '@/lib/orders';
import { fail, HttpError } from '@/lib/server';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string; assetId: string }> },
) {
  try {
    const { orderId, assetId } = await params;
    let order;
    try {
      const u = await buyer(request);
      order = await orderDetail(orderId, String(u.id));
    } catch {
      await orderAdmin('view');
      order = await orderDetail(orderId);
    }
    if (!order.items.some((item: any) => item.snapshot.imageId === assetId))
      throw new HttpError(404, '图片不存在');
    const image = await env.FILES?.get(assetId);
    if (!image) throw new HttpError(404, '图片不存在');
    return new Response(image.body, {
      headers: {
        'Content-Type': image.httpMetadata?.contentType || 'image/png',
        'Cache-Control': 'private,no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
