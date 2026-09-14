import { database } from './server';
import { syncOrderPoints } from './order-points';
import { settleRedemption } from './redemption';
// Durable receipts bridge the CMS and identity databases. Retry oldest attempts first.
export async function recoverPointOrders() {
  const db=database();
  const rows=(await db.prepare("SELECT id,currency FROM orders WHERE json_extract(data,'$.pointsPending')=1 OR (currency='PTS' AND json_extract(data,'$.redemptionState')='pending') ORDER BY COALESCE(json_extract(data,'$.pointsAttemptAt'),created_at) LIMIT 10").all<any>()).results;
  let failed=0;
  for(const row of rows) {
    await db.prepare("UPDATE orders SET data=json_set(data,'$.pointsAttemptAt',?) WHERE id=?").bind(new Date().toISOString(),row.id).run();
    try { if(row.currency==='PTS') await settleRedemption(row.id); else await syncOrderPoints(row.id); }
    catch { failed++; }
  }
  return {processed:rows.length-failed,failed};
}
