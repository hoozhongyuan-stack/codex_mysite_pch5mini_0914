import { database } from './server';
import { channelState } from './channel-store';
import { buildNotificationRequest, targetLabel, triggerLabels } from './notification-template.mjs';

const SETTINGS_ID = 'notification_records';
const safeText = (value, max = 120) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const allowedTypes = new Set(['order', 'event', 'points']);
const allowedStatus = new Set(['pending', 'skipped', 'failed', 'sent']);

export async function notificationRecords(limit = 50) {
  const row = await database()
    .prepare('SELECT data FROM settings WHERE id=?')
    .bind(SETTINGS_ID)
    .first();
  const records = row?.data ? JSON.parse(row.data) : [];
  return Array.isArray(records) ? records.slice(0, Math.max(1, Math.min(200, limit))) : [];
}

export async function recordNotificationAttempt(input = {}) {
  const type = allowedTypes.has(input.type) ? input.type : 'order';
  const status = allowedStatus.has(input.status) ? input.status : 'pending';
  const record = {
    id: crypto.randomUUID(),
    type,
    status,
    target: safeText(input.target, 120),
    trigger: safeText(input.trigger, 80),
    message: safeText(input.message, 200),
    createdAt: new Date().toISOString(),
  };
  const current = await notificationRecords(199);
  const next = [record, ...current].slice(0, 200);
  await database()
    .prepare("INSERT INTO settings(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data")
    .bind(SETTINGS_ID, JSON.stringify(next))
    .run();
  return record;
}

export async function sendConfiguredNotification(type, trigger, payload = {}) {
  const recordBase = { type, trigger: triggerLabels[trigger] || trigger, target: targetLabel(type, payload) };
  try {
    const mini = (await channelState()).published?.mini;
    const center = mini?.notificationCenter;
    const template = center?.templates?.[type];
    if (!center?.enabled) return recordNotificationAttempt({ ...recordBase, status: 'skipped', message: '通知中心未启用' });
    if (!center.triggers?.[trigger]) return recordNotificationAttempt({ ...recordBase, status: 'skipped', message: '触发开关未启用' });
    if (!template?.enabled || !template.templateId) return recordNotificationAttempt({ ...recordBase, status: 'skipped', message: '模板未启用或未配置' });
    if (!payload.userId) return recordNotificationAttempt({ ...recordBase, status: 'skipped', message: '缺少会员ID' });
    const request = buildNotificationRequest(type, trigger, payload, template.templateId);
    const { identity } = await import('./identity');
    await identity('mini-subscribe-send', request);
    return recordNotificationAttempt({ ...recordBase, status: 'sent', message: '微信订阅消息已提交' });
  } catch (error) {
    return recordNotificationAttempt({ ...recordBase, status: 'failed', message: error instanceof Error ? error.message : '发送失败' });
  }
}

export const notifyOrder = (trigger, payload) => sendConfiguredNotification('order', trigger, payload);
export const notifyEvent = (trigger, payload) => sendConfiguredNotification('event', trigger, payload);
export const notifyPoints = (payload) => sendConfiguredNotification('points', 'pointsChanged', payload);
