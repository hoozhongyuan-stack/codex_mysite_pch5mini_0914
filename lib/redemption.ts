import {channelPredicate} from './mini-business.mjs';
import { database } from './server';
import { identity } from './identity';
import { address, integer, text } from './order-domain.mjs';
import { commerceConfig, orderDetail } from './orders';
export async function settleRedemption(id: string) {
  const db = database();
  let row = await db.prepare("SELECT * FROM orders WHERE id=? AND currency='PTS'").bind(id).first<any>();
  if (!row) throw Error('兑换订单不存在');
  const body = {userId:Number(row.user_id), id, points:row.total};
  if (row.status === 'closed') {
    await identity('points-redemption', {...body, action:'refund'});
    await db.prepare("UPDATE orders SET data=json_set(data,'$.redemptionState','settled') WHERE id=?").bind(id).run();
    return;
  }
  if (row.paid) return;
  try { await identity('points-redemption', {...body, action:'debit'}); }
  catch (e: any) {
    // Definitive business rejection can close the inventory reservation. Transport errors stay recoverable.
    if (e.status === 400) await db.prepare("UPDATE orders SET status='closed' WHERE id=? AND paid=0 AND status IN ('pending_payment','pending_review')").bind(id).run();
    throw e;
  }
  await db.batch([
    db.prepare("UPDATE orders SET status='pending_review' WHERE id=? AND status='pending_payment'").bind(id),
    db.prepare("UPDATE orders SET status='pending_ship',paid=1,data=json_set(data,'$.redemptionState','settled') WHERE id=? AND status='pending_review' AND paid=0").bind(id),
  ]);
  row = await db.prepare('SELECT status FROM orders WHERE id=?').bind(id).first<any>();
  if (row.status === 'closed') await identity('points-redemption', {...body, action:'refund'});
}
export async function createRedemption(user: any, input: any, channel: "website" | "mini" = "website") {
  const db = database(), key = text(input.requestKey,80,true);
  if (!/^[\w-]{16,80}$/.test(key)) throw Error('请求标识无效');
  const productId = text(input.productId,80,true), variantKey = text(input.variant,200,true), quantity = integer(input.quantity,1,999);
  const shippingAddress = address(input.address);
  const fingerprint = JSON.stringify({productId,variantKey,quantity,shippingAddress,...(channel==='mini'?{channel}: {})});
  const prior = await db.prepare('SELECT id,data,currency FROM orders WHERE user_id=? AND request_key=?').bind(String(user.id),key).first<any>();
  if (prior) {
    if (prior.currency !== 'PTS' || JSON.parse(prior.data).fingerprint !== fingerprint) throw Error('提交标识已用于其他订单');
    await settleRedemption(prior.id); return orderDetail(prior.id,String(user.id));
  }
  const row = await db.prepare(`SELECT * FROM contents WHERE id=? AND kind='products' AND status='published' AND ${channelPredicate(channel)}`).bind(productId).first<any>();
  if (!row) throw Error('商品已下架');
  const product = JSON.parse(row.data), variant = product.trade?.variants?.find((v:any) => v.key === variantKey && v.enabled);
  if (!product.trade?.redemptionEnabled || !variant?.pointsPrice) throw Error('此规格暂不支持兑换');
  const config = await commerceConfig();
  if (user.sandbox && !(config.testProductIds || []).includes(productId)) throw Error('沙箱账号只能兑换指定测试商品');
  const unitPrice = integer(variant.pointsPrice,1,1000000), total = unitPrice*quantity, id = crypto.randomUUID(), at = new Date().toISOString();
  const data = {sourceEnd:channel==='mini'?'mini':'web',orderType:'points', redemptionState:'pending', address:shippingAddress,email:user.email,fingerprint, methods:[],afterSaleDays:config.afterSaleDays ?? 7};
  const snapshot = {productId,variant:variantKey,quantity,unitPrice,titleZh:product.titleZh,titleEn:product.titleEn,spu:product.spu || '',imageId:product.imageId || product.imageIds?.[0] || '',specs:(product.trade.specs || []).map((s:any)=>({...s,values:s.values.filter((v:any)=>variantKey.split('~').includes(v.id))}))};
  try { await db.batch([
    db.prepare('INSERT INTO orders(id,user_id,request_key,status,currency,subtotal,shipping,total,data,sandbox,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,String(user.id),key,'building','PTS',total,0,total,JSON.stringify(data),user.sandbox?1:0,new Date(Date.now()+3600000).toISOString(),at,at),
    db.prepare('INSERT INTO order_items VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,productId,variantKey,quantity,unitPrice,JSON.stringify(snapshot)),
    db.prepare("UPDATE orders SET status='pending_payment' WHERE id=?").bind(id),
    db.prepare('INSERT INTO order_history VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,String(user.id),'redeem-create','{}',at),
  ]); } catch (error) {
    const concurrent = await db.prepare('SELECT id,data,currency FROM orders WHERE user_id=? AND request_key=?').bind(String(user.id),key).first<any>();
    if (!concurrent || concurrent.currency !== 'PTS' || JSON.parse(concurrent.data).fingerprint !== fingerprint) throw error;
    await settleRedemption(concurrent.id); return orderDetail(concurrent.id,String(user.id));
  }
  await settleRedemption(id);
  return orderDetail(id,String(user.id));
}
export async function cancelRedemption(id:string,userId:string,actor=userId,reason='') {
  const db=database(), order=await orderDetail(id,userId);
  if(order.currency!=='PTS') throw Error('非积分兑换订单');
  if(order.status==='closed') { await settleRedemption(id); return orderDetail(id,userId); }
  if(order.status!=='pending_ship') throw Error('仅未发货兑换订单可直接取消');
  const revision=crypto.randomUUID(),at=new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE orders SET status='aftersale',data=json_set(data,'$.revision',?,'$.redemptionState','pending') WHERE id=? AND status='pending_ship' AND updated_at=?").bind(revision,id,order.updated_at),
    db.prepare("INSERT INTO order_history VALUES(?,(SELECT CASE WHEN json_extract(data,'$.revision')=? THEN id ELSE NULL END FROM orders WHERE id=?),?,'redeem-cancel',?,?)").bind(crypto.randomUUID(),revision,id,actor,JSON.stringify({reason}),at),
    db.prepare("UPDATE orders SET status='closed',refunded=1,updated_at=? WHERE id=?").bind(at,id),
    db.prepare('UPDATE orders SET restocked=1 WHERE id=?').bind(id),
  ]);
  await settleRedemption(id); return orderDetail(id,userId);
}
