import { quoteStamp } from './checkout-confirmation.mjs';
import {channelPredicate} from './mini-business.mjs';
import { refundQuote } from './refund-domain.mjs';
import { syncOrderPoints } from './order-points';
import { database, HttpError, admin } from './server';
import { identity, visitorSession } from './identity';
import {
  orderConfig,
  checkout,
  address,
  text,
  integer,
  transition,
} from './order-domain.mjs';
export const defaultOrderConfig = {
  enabled: false,paymentChannels:{offline:false,wechat:false},miniPayments:{offline:false,wechat:false},
  timeoutHours: 24,
  afterSaleDays: null,
  shipping: { CNY: 0, USD: 0, EUR: 0, GBP: 0, HKD: 0 },
  methods: [],
  grants: {},
};
export async function commerceConfig() {
  const row = await database()
    .prepare("SELECT data FROM settings WHERE id='commerce'")
    .first<any>();
  if (!row) return defaultOrderConfig;
  const stored = { ...defaultOrderConfig, ...JSON.parse(row.data) };
  const legacy = stored.miniPayments || {};
  // `paymentChannels` is the single source for PC, H5 and mini checkout.
  // Existing settings retain their former site/mini offline behavior until saved again.
  const paymentChannels = {
    offline: stored.paymentChannels?.offline === true || (!stored.paymentChannels && (stored.enabled === true || legacy.offline === true)),
    wechat: stored.paymentChannels?.wechat === true || legacy.wechat === true,
  };
  return { ...stored, paymentChannels, miniPayments: paymentChannels };
}
export async function orderAdmin(permission: string) {
  const user = await admin();
  if (user.role === 'owner') return { ...user, orderRole: 'owner' };
  const config = await commerceConfig();
  if (!user.permissions.includes('orders.' + permission) && !config.grants?.[user.email.toLowerCase()]?.includes(permission))
    throw new HttpError(403, '没有此订单操作权限');
  return { ...user, orderRole: permission };
}
export async function buyer(request: Request) {
  const result = await identity('session', {
    session: visitorSession(request),
  });
  if (!result.user) throw new HttpError(401, '请先登录 / Please sign in');
  return result.user;
}
const now = () => new Date().toISOString();
export function parsedOrder(row: any, privateView = false) {
  const data = JSON.parse(row.data);
  if (!privateView) delete data.internalNote;
  return { ...row, data };
}
export async function expireOrders() {
  const db = database(),
    at = now();
  await db.batch([
    db
      .prepare(
        "INSERT INTO order_history(id,order_id,actor,action,data,created_at) SELECT lower(hex(randomblob(16))),id,'system','expire','{}',? FROM orders WHERE status='pending_payment' AND expires_at<=?",
      )
      .bind(at, at),
    db
      .prepare(
        "UPDATE orders SET status='closed',data=json_set(data,'$.closeReason','付款超时'),updated_at=? WHERE status='pending_payment' AND expires_at<=?",
      )
      .bind(at, at),
  ]);
}
export async function orderDetail(id: string, userId?: string) {
  const db = database();
  const row = await db
    .prepare('SELECT * FROM orders WHERE id=?')
    .bind(id)
    .first<any>();
  if (!row || (userId && row.user_id !== userId))
    throw new HttpError(404, '订单不存在');
  const [items, history] = await Promise.all([
    db
      .prepare('SELECT * FROM order_items WHERE order_id=?')
      .bind(id)
      .all<any>(),
    db
      .prepare(
        'SELECT * FROM order_history WHERE order_id=? ORDER BY created_at,id',
      )
      .bind(id)
      .all<any>(),
  ]);
  return {
    ...parsedOrder(row, !userId),
    items: items.results.map((i) => ({
      ...i,
      snapshot: JSON.parse(i.snapshot),
    })),
    history: history.results
      .filter((h) => !userId || h.action !== 'note')
      .map((h) => ({
        ...h,
        actor: userId ? '' : h.actor,
        data: JSON.parse(h.data),
      })),
  };
}
export async function createOrder(user: any, input: any, channel:"website"|"mini"="website") {
  const db = database(),
    key = text(input.requestKey, 80, true),
    shippingAddress = address(input.address);
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(key)) throw Error('提交标识无效');
  const fingerprint = JSON.stringify({
    items: input.items,
    ...(channel==='mini'?{channel}:{}),
    address: shippingAddress,
    note: input.note || '',
  });
  const prior = await db
    .prepare('SELECT id,data FROM orders WHERE user_id=? AND request_key=?')
    .bind(String(user.id), key)
    .first<any>();
  if (prior) {
    if (JSON.parse(prior.data).fingerprint !== fingerprint)
      throw Error('同一提交标识不能用于不同订单');
    return orderDetail(prior.id, String(user.id));
  }
  if (
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 30
  )
    throw Error('请选择1至30个商品规格');
  const products = await Promise.all(
    [
      ...new Set<string>(
        input.items.map((i: any) => text(i.productId, 80, true)),
      ),
    ].map(async (id) => {
      const r = await db
        .prepare(`SELECT * FROM contents WHERE id=? AND kind='products' AND ${channelPredicate(channel)}`)
        .bind(id)
        .first<any>();
      return r ? { ...JSON.parse(r.data), id: r.id, status: r.status } : null;
    }),
  );
  const config = await commerceConfig();
  // Test checkout is explicitly restricted to products marked for sandbox in configuration.
  if (
    user.sandbox &&
    !input.items.every((i: any) =>
      (config.testProductIds || []).includes(i.productId),
    )
  )
    throw Error('沙箱账号只能购买指定测试商品');
  const quote = checkout(input.items, products.filter(Boolean), {...config,enabled:config.paymentChannels?.offline===true}),
    id = crypto.randomUUID(),
    at = now();
  if(channel==='mini' && (!input.expectedQuote || input.expectedQuote!==quoteStamp(quote))) throw new HttpError(409,'商品价格或运费已变化，请重新核对订单金额后提交');
  const data = {
    sourceEnd:channel==='mini'?'mini':'web',paymentChannel:'offline',
    address: shippingAddress,
    email: user.email,
    note: text(input.note || '', 1000),
    fingerprint,
    methods: config.methods.filter((m: any) => m.enabled),
    timeoutHours: config.timeoutHours,
    afterSaleDays: config.afterSaleDays,
    purchasePoints: quote.items.reduce((sum: number, item: any) => sum + item.rewardPoints * item.quantity, 0),
  };
  const commands = [
    db
      .prepare(
        'INSERT INTO orders(id,user_id,request_key,status,currency,subtotal,shipping,total,data,sandbox,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .bind(
        id,
        String(user.id),
        key,
        'building',
        quote.currency,
        quote.subtotal,
        quote.shipping,
        quote.total,
        JSON.stringify(data),
        user.sandbox ? 1 : 0,
        new Date(Date.now() + config.timeoutHours * 3600000).toISOString(),
        at,
        at,
      ),
    ...quote.items.map((i: any) =>
      db
        .prepare('INSERT INTO order_items VALUES(?,?,?,?,?,?,?)')
        .bind(
          crypto.randomUUID(),
          id,
          i.productId,
          i.variant,
          i.quantity,
          i.unitPrice,
          JSON.stringify(i),
        ),
    ),
    db
      .prepare("UPDATE orders SET status='pending_payment' WHERE id=?")
      .bind(id),
    db
      .prepare('INSERT INTO order_history VALUES(?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), id, String(user.id), 'create', '{}', at),
  ];
  // Delete only the exact quantity observed by this checkout. Concurrent cart edits survive.
  if (input.fromCart)
    for (const item of quote.items)
      commands.push(
        db
          .prepare(
            'DELETE FROM cart_items WHERE user_id=? AND product_id=? AND variant=? AND quantity=?',
          )
          .bind(String(user.id), item.productId, item.variant, item.quantity),
      );
  try {
    await db.batch(commands);
  } catch (e) {
    const repeated = await db
      .prepare('SELECT id,data FROM orders WHERE user_id=? AND request_key=?')
      .bind(String(user.id), key)
      .first<any>();
    if (repeated && JSON.parse(repeated.data).fingerprint === fingerprint)
      return orderDetail(repeated.id, String(user.id));
    throw e;
  }
  return orderDetail(id, String(user.id));
}
export async function actOrder(
  id: string,
  action: string,
  actor: string,
  role: string,
  input: any,
  userId?: string,
) {
  const db = database();
  await orderDetail(id, userId); // Verify ownership before reading private mutation state.
  const order = await orderDetail(id),
    data = { ...order.data };
  const config = await commerceConfig();
  const at = now();
  if (order.currency === 'PTS' && ['approve','reject','proof','close','cancel'].includes(action)) throw Error('积分订单请使用兑换操作');
  if (action === 'note') {
    if (role !== 'owner' && role !== 'manage') throw Error('无备注权限');
    data.internalNote = text(input.note || '', 2000);
  } else if (action === 'logistics') {
    if (
      !['owner', 'fulfill'].includes(role) ||
      !['pending_receive', 'completed'].includes(order.status)
    )
      throw Error('当前不能更正物流');
    data.logistics = {
      ...data.logistics,
      correctedAt: at,
      company: text(input.company || '', 100),
      number: text(input.number || '', 100),
      note: text(input.note || '', 1000),
    };
  } else if (action === 'restock') {
    if (
      !['owner', 'aftersale'].includes(role) ||
      !order.refunded ||
      order.restocked
    )
      throw Error('库存不可返还');
    text(input.reason, 500, true);
  } else {
    const refund = action === 'refund' ? refundQuote(order,input.items) : null;
    if(refund && order.currency==='PTS' && !refund.full) throw Error('积分兑换订单目前仅支持整单退回');
    if(refund && input.amount !== refund.amount) throw Error('退款金额与所选商品数量不一致');
    const next = transition(
      { ...order, priorStatus: data.priorStatus },
      action,
      role,
      refund ? {...input,amount:order.total} : input,
    );
    if (action === 'proof') {
      if (new Date(order.expires_at).getTime() <= Date.now())
        throw Error('订单已超时');
      const method = data.methods.find((m: any) => m.id === input.methodId);
      if (
        !method ||
        !config.methods.some((m: any) => m.id === input.methodId && m.enabled)
      )
        throw Error('收款方式已停用，请联系管理员');
      if (
        !Array.isArray(input.files) ||
        !input.files.length ||
        input.files.length > 6
      )
        throw Error('请上传1至6张付款凭证');
      for (const file of input.files)
        if (
          !(await db
            .prepare(
              "SELECT id FROM order_files WHERE id=? AND order_id=? AND user_id=? AND purpose='payment'",
            )
            .bind(text(file, 36, true), id, order.user_id)
            .first())
        )
          throw Error('付款凭证不属于当前订单');
      if(!Number.isFinite(Date.parse(input.paidAt)))throw Error('付款时间无效');
      data.latestProof = {
        methodId: method.id,
        files: input.files,
        payer: text(input.payer, 100, true),
        paidAt: text(input.paidAt, 50, true),
        note: text(input.note || '', 1000),
      };
    }
    if (action === 'approve') {
      data.receipt = {
        amount: input.amount,
        receivedAt: text(input.receivedAt, 50, true),
        note: text(input.note || '', 1000),
      };
      if (!Number.isFinite(Date.parse(data.receipt.receivedAt)))
        throw Error('到账时间无效');
    }
    if (action === 'ship')
      data.logistics = {
        company: text(input.company || '', 100),
        number: text(input.number || '', 100),
        note: text(input.note || '', 1000),
        shippedAt: at,
      };
    if (action === 'receive') data.completedAt = at;
    if (action === 'aftersale') {
      if (
        order.status === 'completed' &&
        (!data.completedAt ||
          Date.now() >
            Date.parse(data.completedAt) + data.afterSaleDays * 86400000)
      )
        throw Error('已超过售后申请期限');
      const files = input.files || [];
      if (!Array.isArray(files) || files.length > 6)
        throw Error('售后图片最多6张');
      for (const file of files)
        if (
          !(await db
            .prepare(
              "SELECT id FROM order_files WHERE id=? AND order_id=? AND user_id=? AND purpose='aftersale'",
            )
            .bind(file, id, order.user_id)
            .first())
        )
          throw Error('售后图片无效');
      data.priorStatus = order.status;
      data.aftersale = {
        reason: text(input.reason, 500, true),
        description: text(input.description || '', 2000),
        files,
        kind: order.status === 'pending_ship' ? 'refund' : 'return_refund',
        createdAt: at,
      };
    }
    if (action === 'refund') {
      if (
        order.currency !== 'PTS' && (!input.file ||
        !(await db
          .prepare(
            "SELECT id FROM order_files WHERE id=? AND order_id=? AND purpose='refund'",
          )
          .bind(input.file, id)
          .first()))
      )
        throw Error('请上传退款凭证');
      data.refundedItems = refund!.totals;
      data.refundedPoints = (data.refundedPoints || 0) + refund!.points;
      data.refundedAmount = (data.refundedAmount || 0) + refund!.amount;
      data.refund = {
        items: refund!.items,
        full: refund!.full,
        amount: input.amount,
        refundedAt: text(input.refundedAt, 50, true),
        note: text(input.note || '', 1000),
        returned: !!input.returned,
        file: input.file || '',
      };
      if (!Number.isFinite(Date.parse(data.refund.refundedAt)))
        throw Error('退款时间无效');
    }
    if (['cancel', 'close', 'refund'].includes(action))
      data.closeReason =
        action === 'refund'
          ? '退款关闭'
          : action === 'cancel'
            ? '用户取消'
            : text(input.reason, 500, true);
    if (action === 'reject') data.rejection = text(input.reason, 500, true);
    order.status = refund && !refund.full ? data.priorStatus : next;
  }
  const actionData =
    action === 'proof'
      ? data.latestProof
      : action === 'ship' || action === 'logistics'
        ? data.logistics
        : action === 'approve'
          ? data.receipt
          : action === 'aftersale'
            ? data.aftersale
            : action === 'refund'
              ? data.refund
              : {
                  reason: input.reason || '',
                  ...(action === 'note' ? { note: data.internalNote } : {}),
                };
  const expiry =
    action === 'reject'
      ? new Date(Date.now() + config.timeoutHours * 3600000).toISOString()
      : order.expires_at;
  // RETURNING/CAS is enforced by a transaction-local assertion inserted into history.
  const revision = crypto.randomUUID();
  data.revision = revision;
  if (order.currency === 'PTS' && action === 'refund') data.redemptionState = 'pending';
  if (['receive', 'refund'].includes(action) && data.purchasePoints > 0) data.pointsPending = true;
  await db.batch([
    db
      .prepare(
        "UPDATE orders SET status=?,data=?,paid=?,refunded=?,restocked=?,expires_at=?,updated_at=? WHERE id=? AND updated_at=? AND json_extract(data,'$.revision') IS ?",
      )
      .bind(
        order.status,
        JSON.stringify(data),
        action === 'approve' ? 1 : order.paid,
        action === 'refund' && order.status === 'closed' ? 1 : order.refunded,
        action === 'restock' ? 1 : order.restocked,
        expiry,
        at,
        id,
        order.updated_at,
        order.data.revision ?? null,
      ),
    db
      .prepare(
        "INSERT INTO order_history(id,order_id,actor,action,data,created_at) VALUES(?,(SELECT CASE WHEN json_extract(data,'$.revision')=? THEN id ELSE NULL END FROM orders WHERE id=?),?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        revision,
        id,
        actor,
        action,
        JSON.stringify(actionData),
        at,
      ),
  ]);
  if (order.currency === 'PTS' && action === 'refund') {
    try { const {settleRedemption} = await import('./redemption'); await settleRedemption(id); } catch { /* Durable redemption receipt remains pending. */ }
  }
  if (data.pointsPending) {
    try { await syncOrderPoints(id); } catch { /* Durable pending receipt is retried from points management. */ }
  }
  return orderDetail(id, userId);
}
