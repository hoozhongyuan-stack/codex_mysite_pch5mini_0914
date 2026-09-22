import { database } from './server';
import { identity } from './identity';
import { notifyPoints } from './notification-center.mjs';
export async function syncOrderPoints(id: string) {
  const db = database();
  const row = await db.prepare('SELECT id,user_id,status,refunded,data FROM orders WHERE id=?').bind(id).first<any>();
  if (!row) return;
  const data = JSON.parse(row.data);
  if (!data.pointsPending || data.purchasePoints === undefined || data.orderType === 'points') return;
  const phase = row.refunded || data.refundedPoints ? 'refunded' : data.completedAt ? 'completed' : '';
  if (!phase) return;
  await identity('points-order', {id, userId:Number(row.user_id), points:data.purchasePoints, phase, refundedPoints:data.refundedPoints ?? (row.refunded ? data.purchasePoints : 0), completed:!!data.completedAt});
  await notifyPoints({
    userId: Number(row.user_id),
    orderId: id,
    amount: phase === 'refunded' ? -(data.refundedPoints ?? (row.refunded ? data.purchasePoints : 0)) : data.purchasePoints,
    title: phase === 'refunded' ? '订单积分冲正' : '订单完成赠分',
    reason: phase === 'refunded' ? 'order.refund' : 'order.complete',
  });
  // A concurrent refund has a different revision and must retain its pending receipt.
  await db.prepare("UPDATE orders SET data=json_set(data,'$.pointsPending',json('false')) WHERE id=? AND json_extract(data,'$.revision') IS ?")
    .bind(id, data.revision ?? null).run();
}
