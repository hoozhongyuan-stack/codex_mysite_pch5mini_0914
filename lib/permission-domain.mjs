export const orderPermissionKeys = ['view','manage','finance','fulfill','aftersale','export','settings'];
export const legacyOrderSql = {
  update: "UPDATE settings SET data=? WHERE id='commerce' AND data=?",
  audit: "INSERT INTO audit_logs SELECT ?,?,'permission-legacy-orders',?,? FROM settings WHERE id='commerce' AND json_extract(data,'$.permissionRevision')=?",
};
export function legacyOrderUpdate(config, input) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!Object.hasOwn(config.grants || {}, email)) throw Error('历史授权不存在；新增授权请使用权限组');
  const permissions = input.permissions;
  if (!Array.isArray(permissions) || permissions.length > 7 || permissions.some(p => !orderPermissionKeys.includes(p))) throw Error('权限无效');
  if (JSON.stringify(input.previous) !== JSON.stringify(config.grants[email])) throw Error('历史授权已更新，请刷新后重试');
  return { ...config, grants: { ...config.grants, [email]: [...new Set(permissions)].sort() } };
}
