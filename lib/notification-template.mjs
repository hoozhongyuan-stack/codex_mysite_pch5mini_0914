const safeText = (value, max = 120) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export const triggerLabels = {
  orderPaid: '订单支付/提交后',
  orderShipped: '订单发货后',
  eventRegistered: '沙龙会报名后',
  eventChanged: '沙龙会变更时',
  pointsChanged: '积分变动时',
};

function textValue(value, max = 20) {
  const text = safeText(value, max);
  return text || '—';
}
function amountText(value, currency = 'CNY') {
  if (!Number.isFinite(value)) return '—';
  if (currency === 'PTS') return `${value}积分`;
  return `${currency === 'CNY' ? '¥' : currency + ' '}${(value / 100).toFixed(2)}`;
}
export function templateData(type, trigger, payload = {}) {
  if (type === 'order') {
    return {
      thing1: { value: textValue(payload.title || '订单状态更新') },
      character_string2: { value: textValue(payload.orderNumber || payload.orderId, 32) },
      amount3: { value: amountText(payload.total, payload.currency) },
      phrase4: { value: textValue(payload.status || triggerLabels[trigger]) },
      time5: { value: textValue(payload.time || new Date().toISOString(), 20) },
    };
  }
  if (type === 'event') {
    return {
      thing1: { value: textValue(payload.title || '沙龙会通知') },
      phrase2: { value: textValue(payload.status || triggerLabels[trigger]) },
      time3: { value: textValue(payload.time || payload.starts || new Date().toISOString(), 20) },
      thing4: { value: textValue(payload.location || payload.address || '请查看详情') },
    };
  }
  return {
    thing1: { value: textValue(payload.title || '积分变动') },
    number2: { value: String(Number.isFinite(payload.amount) ? payload.amount : payload.points || 0) },
    number3: { value: String(Number.isFinite(payload.balance) ? payload.balance : 0) },
    time4: { value: textValue(payload.time || new Date().toISOString(), 20) },
  };
}
export function targetLabel(type, payload = {}) {
  if (type === 'order') return safeText(payload.orderNumber || payload.orderId || payload.userId, 120);
  if (type === 'event') return safeText(payload.registrationId || payload.eventId || payload.userId, 120);
  return safeText(payload.userId || payload.orderId || payload.reason, 120);
}
export function pageFor(type, payload = {}) {
  if (type === 'order' && payload.orderId) return `pages/account/index?section=orders&id=${encodeURIComponent(payload.orderId)}`;
  if (type === 'event' && payload.eventId) return `pages/salons/index?id=${encodeURIComponent(payload.eventId)}`;
  if (type === 'points') return 'pages/account/index?section=points';
  return 'pages/account/index';
}
export function buildNotificationRequest(type, trigger, payload = {}, templateId = '') {
  return {
    type,
    trigger,
    userId: payload.userId,
    templateId,
    page: pageFor(type, payload),
    data: templateData(type, trigger, payload),
  };
}
