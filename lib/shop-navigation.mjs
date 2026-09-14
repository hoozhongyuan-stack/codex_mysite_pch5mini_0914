// Only public shopping/marketing destinations may be used after sign-in.
export function safeShopReturn(value) {
  if (typeof value !== 'string' || /[\\\u0000-\u0020]/.test(value)) return '';
  if (!/^\/(zh|en)\/(events|orders|cart|products|articles|videos|points-shop|account)(?:\/|\?|$)/.test(value)) return '';
  const path = value.split('?')[0];
  if (path.split('/').some(part => part === '.' || part === '..') || /%/i.test(path)) return '';
  return value;
}
export function accountLanguageHref(lang, returnTo) {
  const safe = safeShopReturn(returnTo);
  return `/${lang}/account` + (safe ? '?' + new URLSearchParams({returnTo: safe.replace(/^\/(zh|en)/, '/' + lang)}) : '');
}
export function orderErrorText(error, en = false) {
  if (error?.status === 401) return en ? 'Please sign in to continue.' : '请先登录后继续。';
  if (error instanceof TypeError) return en ? 'Connection failed. Please try again.' : '连接失败，请稍后重试。';
  const message = error?.message || '';
  if (!en) return message || '请求失败，请稍后重试。';
  if (/库存/.test(message)) return 'Insufficient stock. Please reduce the quantity.';
  if (/币种/.test(message)) return 'Please check out different currencies separately.';
  if (/未启用|暂停/.test(message)) return 'Purchasing is currently unavailable.';
  if (/登录/.test(message)) return 'Please sign in to continue.';
  if (/沙箱/.test(message)) return 'Use the designated test product with your sandbox account.';
  if (/过期|超时/.test(message)) return 'This request has expired. Please refresh and try again.';
  if (/权限|无权/.test(message) || error?.status === 403) return 'You do not have permission to access this item.';
  if (error?.status === 404) return 'This item could not be found.';
  return /[\u3400-\u9fff]/.test(message) ? 'Unable to complete this action. Please check your details and try again.' : message || 'Request failed. Please try again.';
}
