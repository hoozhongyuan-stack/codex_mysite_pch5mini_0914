import { database, HttpError } from './server';
import { legacyOrderUpdate, legacyOrderSql } from './permission-domain.mjs';

export async function saveLegacyOrders(input: any, actor: string) {
  const db = database();
  const row = await db.prepare("SELECT data FROM settings WHERE id='commerce'").first<any>();
  if (!row) throw new HttpError(400, '历史订单授权不存在');
  const previous = JSON.parse(row.data);
  const updated = legacyOrderUpdate(previous, input);
  const marker = crypto.randomUUID();
  const email = input.email.trim().toLowerCase();
  const audit = JSON.stringify({ target: email, before: previous.grants[email], after: updated.grants[email] });
  const results = await db.batch([
    db.prepare(legacyOrderSql.update).bind(JSON.stringify({ ...updated, permissionRevision: marker }), row.data),
    db.prepare(legacyOrderSql.audit).bind(crypto.randomUUID(), actor, audit, new Date().toISOString(), marker),
  ]);
  if (!results[0].meta.changes) throw new HttpError(409, '交易设置已更新，请刷新后重试');
  return { ok: true };
}

export async function orderPermissionLogs() {
  const rows = (await database().prepare("SELECT * FROM audit_logs WHERE action='permission-legacy-orders' ORDER BY created_at DESC LIMIT 200").all<any>()).results;
  return rows.map((row: any) => {
    const snapshot = JSON.parse(row.target);
    return { id: row.id, actor: row.actor, action: row.action, target: snapshot.target, before: snapshot.before, after: snapshot.after, created: row.created_at };
  });
}
