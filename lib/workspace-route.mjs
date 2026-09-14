export const workspaceViews = [
  'mini',
  'floating',
  'overview',
  'marketing',
  'videoSeries',
  'orders',
  'commerce',
  'articleCategories',
  'productCategories',
  'navigation',
  'admins',
  'accounts',
  'permissions',
  'policies',
  'articles',
  'products',
  'forms',
  'submissions',
  'logs',
  'assets',
  'videos',
  'users',
  'points',
  'pointsMall',
  'geo',
  'themes',
  'settings',
];
export function workspaceView(value) {
  if (value === 'folders') return 'assets';
  if (['payments', 'aftersales'].includes(value)) return 'orders';
  return workspaceViews.includes(value) ? value : 'overview';
}
export function selectedAssetId(asset) {
  return asset?.id || '';
}
