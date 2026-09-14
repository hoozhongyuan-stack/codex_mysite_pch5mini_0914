export function pointLabel(source: string, en = false): string {
  const fixed: Record<string, [string, string]> = {
    'redemption.debit': ['积分兑换', 'Points redemption'],
    'redemption.refund': ['兑换积分退回', 'Redemption refund'],
    'order.refund-marker': ['退款核对记录', 'Refund checkpoint'],
    'order.complete': ['订单完成赠分', 'Purchase reward'], 'order.refund': ['购买赠分退款冲正', 'Purchase reward reversal'],
    registration: ['注册验证', 'Registration'], login: ['每日访问', 'Daily visit'], form: ['提交表单', 'Form submission'],
    'salon.complete': ['活动完成', 'Event completion'], adjust: ['人工调整', 'Manual adjustment'],
  };
  if (fixed[source]) return fixed[source][en ? 1 : 0];
  const [kind, action] = source.split('.');
  const types: Record<string, [string, string]> = {article: ['文章', 'Article'], product: ['商品', 'Product'], salon: ['沙龙', 'Event'], video: ['视频', 'Video']};
  const actions: Record<string, [string, string]> = {like: ['点赞', 'Like'], favorite: ['收藏', 'Save'], share: ['分享操作', 'Share action']};
  return types[kind] && actions[action] ? `${types[kind][en ? 1 : 0]} · ${actions[action][en ? 1 : 0]}` : source;
}
