import { miniQuote, miniCart, updateMiniCart } from '@/lib/mini-checkout';
import { env } from 'cloudflare:workers';
import { uploadOrderFile } from '@/app/api/order-files/[id]/route';
import { identity } from '@/lib/identity';
import { miniBuyer, bearer } from '@/lib/mini-auth';
import { database, fail, HttpError, jsonBody, limited } from '@/lib/server';
import {
  orderDetail,
  actOrder,
  expireOrders,
  commerceConfig,
  createOrder,
} from '@/lib/orders';
import { createRedemption, cancelRedemption } from '@/lib/redemption';
import { address } from '@/lib/order-domain.mjs';
import { submitForm } from '@/app/api/submit/route';
import { uploadForm } from '@/app/api/form-upload/route';
const json = (d: any) =>
  Response.json(d, { headers: { 'Cache-Control': 'no-store' } });
async function policies() {
  return (
    await database()
      .prepare(
        "SELECT kind,version,published FROM policies WHERE kind IN ('terms','privacy') AND published IS NOT NULL",
      )
      .all<any>()
  ).results.map((r) => ({
    kind: r.kind,
    version: r.version,
    content: JSON.parse(r.published),
  }));
}
export async function GET(request: Request, { params }: any) {
  try {
    const { action } = await params,
      q = new URL(request.url).searchParams,
      db = database();
    if (action === 'status')
      return json({
        ...(await identity('mini-status')),
        policies: await policies(),
      });
    if (action === 'form') {
      const row = await db
        .prepare(
          "SELECT id,data,updated_at FROM contents WHERE id=? AND kind='forms' AND status='published' AND json_extract(data,'$.channels.mini')=1",
        )
        .bind(q.get('id') || '')
        .first<any>();
      if (!row) throw new HttpError(404, '表单未开放');
      const d = JSON.parse(row.data);
      return json({
        id: row.id,
        title: d.titleZh,
        description: d.summaryZh,
        fields: d.fields,
        version: row.updated_at,
        policies: await policies(),
      });
    }
    const { user, session } = await miniBuyer(request);
    if (action === 'payment-image') {
      const order = await orderDetail(q.get('id') || '', String(user.id)),
        asset = q.get('asset') || '';
      if (!order.data.methods?.some((m: any) => m.imageId === asset))
        throw new HttpError(404, '图片不存在');
      const obj = await env.FILES?.get(asset);
      if (!obj) throw new HttpError(404, '图片不存在');
      return new Response(obj.body, {
        headers: {
          'Content-Type': obj.httpMetadata?.contentType || 'image/png',
          'Cache-Control': 'private,no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (action === 'payments') {
      const c = await commerceConfig();
      return json({ offline: c.miniPayments?.offline === true, wechat: false });
    }
    if (action === 'cart') return json(await miniCart(String(user.id)));
    if (action === 'session') return json({ user });
    if (action === 'favorites') return json(await identity('points-favorites',{session,page:Number(q.get('page'))||1}));
    if (action === 'activities') return json(await identity('marketing-mine',{session,page:Number(q.get('page'))||1}));
    if (action === 'history') return json(await identity('video-mine',{session,page:Number(q.get('page'))||1}));

    if (action === 'points')
      return json(
        await identity('points-summary', {
          session,
          page: Number(q.get('page')) || 1,
        }),
      );
    if (action === 'addresses')
      return json({
        rows: (
          await db
            .prepare(
              "SELECT id,data FROM order_addresses WHERE user_id=? ORDER BY COALESCE(json_extract(data,'$.isDefault'),0) DESC,updated_at DESC",
            )
            .bind(String(user.id))
            .all<any>()
        ).results.map((r) => ({ id: r.id, ...JSON.parse(r.data) })),
      });
    if (action === 'orders') {
      await expireOrders();
      const page = Math.max(
        1,
        Math.min(10000, Math.floor(Number(q.get('page')) || 1)),
      );
      const filter=q.get('status')||'';
      if(filter&&!['pending_payment','pending_review','pending_ship','pending_receive','completed','closed','aftersale'].includes(filter))throw new HttpError(400,'订单状态无效');
      const rows = (
        await db
          .prepare(
            "SELECT id,order_number,status,currency,total,created_at FROM orders WHERE user_id=? AND status<>'building' AND (?='' OR status=?) ORDER BY created_at DESC LIMIT 20 OFFSET ?",
          )
          .bind(String(user.id),filter,filter, (page - 1) * 20)
          .all<any>()
      ).results;
      const count = await db
        .prepare(
          "SELECT COUNT(*) AS total FROM orders WHERE user_id=? AND status<>'building' AND (?='' OR status=?)",
        )
        .bind(String(user.id),filter,filter)
        .first<any>();
      const detailed=await Promise.all(rows.map(async r=>({...r,items:(await db.prepare('SELECT quantity,snapshot FROM order_items WHERE order_id=?').bind(r.id).all<any>()).results.map(i=>{const d=JSON.parse(i.snapshot);return {title:d.titleZh,quantity:i.quantity,variant:d.variant};})})));
      return json({ rows:detailed, total: count.total, page });
    }
    if (action === 'order')
      return json(await orderDetail(q.get('id') || '', String(user.id)));

    throw new HttpError(404, '未知操作');
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request, { params }: any) {
  try {
    const { action } = await params;
    await limited(
      'mini:' + (request.headers.get('cf-connecting-ip') || 'anonymous'),
      60,
    );
    if (['login', 'email-login', 'bind'].includes(action)) {
      const data = await jsonBody(request);
      if (action === 'email-login')
        return json(
          await identity('login', {
            email: data.email,
            password: data.password,
            _ip: request.headers.get('cf-connecting-ip') || 'anonymous',
          }),
        );
      const p = await policies();
      if (
        !['terms', 'privacy'].every((kind) =>
          p.some((v) => v.kind === kind && v.version === data[kind]),
        )
      )
        throw new HttpError(409, '请刷新并同意最新协议');
      return json(
        await identity('mini-login', {
          code: data.code,
          terms: data.terms,
          privacy: data.privacy,
          ...(action === 'bind'
            ? { session: bearer(request), intent: 'link' }
            : {}),
          _ip: request.headers.get('cf-connecting-ip') || 'anonymous',
        }),
      );
    }
    const { user, session } = await miniBuyer(request);
    await limited('mini-user:' + user.id, 60);
    if (action === 'proof-upload')
      return uploadOrderFile(
        request,
        {
          params: Promise.resolve({
            id: new URL(request.url).searchParams.get('id') || '',
          }),
        },
        { user },
      );
    if (action === 'form-submit') return submitForm(request, { user });
    if (action === 'form-upload') return uploadForm(request, { user });
    const input = await jsonBody(request),
      db = database();
    if (action === 'logout') return json(await identity('logout', { session }));
    if (action === 'quote') return json(await miniQuote(input.items));
    if (['cart-add','cart-set','cart-remove','cart-merge','cart-variant'].includes(action)) return json(await updateMiniCart(String(user.id),action,input));
    if (action === 'create-order')
      return json(await createOrder(user, input, 'mini'));
    if (['proof', 'receive', 'cancel'].includes(action))
      return json(
        await actOrder(
          String(input.id),
          action,
          String(user.id),
          'user',
          input,
          String(user.id),
        ),
      );
    if (action === 'redeem')
      return json(await createRedemption(user, input, 'mini'));
    if (action === 'cancel-redemption')
      return json(await cancelRedemption(String(input.id), String(user.id)));
    if (action === 'address-save') {
      const d = address(input),
        id = input.id || crypto.randomUUID();
      if (
        input.id &&
        !(await db
          .prepare('SELECT id FROM order_addresses WHERE id=? AND user_id=?')
          .bind(id, String(user.id))
          .first())
      )
        throw new HttpError(404, '地址不存在');
      const writes = [
        db
          .prepare(
            'INSERT INTO order_addresses SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM order_addresses WHERE user_id=?)<20 OR EXISTS(SELECT 1 FROM order_addresses WHERE id=? AND user_id=?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at WHERE user_id=excluded.user_id',
          )
          .bind(
            id,
            String(user.id),
            JSON.stringify(d),
            new Date().toISOString(),
            String(user.id),
            id,
            String(user.id),
          ),
      ];
      if (d.isDefault)
        writes.push(
          db
            .prepare(
              "UPDATE order_addresses SET data=json_set(data,'$.isDefault',json('false')) WHERE user_id=? AND id<>? AND EXISTS(SELECT 1 FROM order_addresses WHERE id=? AND user_id=?)",
            )
            .bind(String(user.id), id, id, String(user.id)),
        );
      const saved = await db.batch(writes);
      if (!saved[0].meta.changes) throw new HttpError(400, '最多保存20个地址');
      return json({ id });
    }
    if (action === 'address-delete') {
      await db
        .prepare('DELETE FROM order_addresses WHERE id=? AND user_id=?')
        .bind(String(input.id), String(user.id))
        .run();
      return json({ ok: true });
    }
    throw new HttpError(404, '未知操作');
  } catch (e) {
    return fail(
      e instanceof HttpError
        ? e
        : new HttpError(
            400,
            e instanceof Error && /库存/.test(e.message)
              ? '库存已变化，请重新核对数量后提交'
              : e instanceof Error && !/SQLITE|D1_|constraint/i.test(e.message)
              ? e.message
              : '操作未完成，请刷新后重试',
          ),
    );
  }
}
