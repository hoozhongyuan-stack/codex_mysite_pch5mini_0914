export function miniToken(header) {
  const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header || '');
  if (!m) throw Error('请先登录小程序');
  return m[1];
}
export function channelPredicate(channel = 'website') {
  if (channel === 'mini') return "json_extract(data,'$.channels.mini')=1";
  if (channel === 'website')
    return "COALESCE(json_extract(data,'$.channels.website'),1)=1";
  throw Error('渠道无效');
}
export function miniPayments(value = {}, ready = false) {
  if (value.wechat === true && !ready)
    throw Error('微信支付尚未完成商户配置与接入验证');
  return { offline: value.offline === true, wechat: value.wechat === true };
}
