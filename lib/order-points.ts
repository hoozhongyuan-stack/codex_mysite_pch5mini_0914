import { database } from './server';
import { identity } from './identity';
export async function syncOrderPoints(id: string) {
  const db = database();
  const row = await db.prepare('SELECT id,user_id,status,refunded,data FROM orders WHERE id=?').bind(id).first<any>();
  if (!row) return;
  const data = JSON.parse(row.data);
  if (!data.pointsPending || data.purchasePoints === undefined || data.orderType === 'points') return;
  const phase = row.refunded || data.refundedPoints ? 'refunded' : data.completedAt ? 'completed' : '';
  if (!phase) return;
  await identity('points-order', {id, userId:Number(row.user_id), points:data.purchasePoints, phase, refundedPoints:data.refundedPoints ?? (row.refunded ? data.purchasePoints : 0), completed:!!data.completedAt});
  // A concurrent refund has a different revision and must retain its pending receipt.
  await db.prepare("UPDATE orders SET data=json_set(data,'$.pointsPending',json('false')) WHERE id=? AND json_extract(data,'$.revision') IS ?")
    .bind(id, data.revision ?? null).run();
}
