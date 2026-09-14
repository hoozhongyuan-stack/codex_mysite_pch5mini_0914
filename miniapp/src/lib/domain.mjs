export const targets = ['home', 'products', 'articles', 'points', 'account', 'cart', 'videos', 'events'];
export function navigation(value) {
  if (!value?.enabled) return [];
  if (!Array.isArray(value.items)) throw Error('导航配置无效');
  const items = value.items.filter((i) => i.enabled);
  if (
    items.length < 2 ||
    items.length > 5 ||
    new Set(items.map((i) => i.target)).size !== items.length ||
    items.some(
      (i) =>
        !targets.includes(i.target) ||
        typeof i.label !== 'string' ||
        !i.label ||
        i.label.length > 12,
    )
  )
    throw Error('导航配置不受当前版本支持');
  return items;
}
export function resolveTarget(current, items) {
  return items.some((i) => i.target === current)
    ? current
    : items[0]?.target || 'home';
}
export function assetUrl(origin, id) {
  return origin && typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id)
    ? origin + '/api/media/' + id
    : '';
}
export function visibleFloating(entries, path) {
  return (entries || [])
    .filter(
      (e) =>
        e.enabled &&
        e.ends?.includes('mini') &&
        (!e.pages?.length || e.pages.includes(path)) &&
        ((e.kind === 'image' &&
          /^[a-zA-Z0-9_-]{1,80}$/.test(e.imageId || '')) ||
          (e.kind === 'phone' && /^\+?[0-9 ()-]{3,30}$/.test(e.phone || '')) ||
          (e.kind === 'form' && /^[a-zA-Z0-9_-]{1,80}$/.test(e.formId || ''))),
    )
    .slice(0, 3);
}

export function destinationUrl(value) {
 const target=value.target==='salons'?'events':value.target;
 const base={cart:'/pages/cart/index',videos:'/pages/videos/index',events:'/pages/salons/index'};
 if(base[target])return base[target];
 if(['product','article','form','video','event'].includes(target)) {
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(value.contentId||'')) throw Error('此内容暂不可用，请返回选择其他内容');
  const id=encodeURIComponent(value.contentId);
  if(target==='video')return '/pages/videos/index?id='+id;
  if(target==='event')return '/pages/salons/index?id='+id;
  if(target==='form')return '/pages/form/index?id='+id;
  return '/pages/detail/index?id='+id+'&kind='+(target==='product'?'products':'articles');
 }
 if(!targets.includes(target))throw Error('此入口暂不可用');
 return '/pages/index/index?target='+encodeURIComponent(target);
}
