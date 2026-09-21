const id = (value) => (typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value) ? value : '');
const title = (value, fallback) => String(value || fallback).trim().slice(0, 60) || fallback;
const shareRef = () => Array.from({length: 24}, () => Math.floor(Math.random() * 36).toString(36)).join('');

/** Public-only share payloads. Never append a session, cart, order or profile value. */
export function publicDetailShare(item, fallback = '发现好内容') {
  const contentId = id(item?.id);
  const kind = item?.kind === 'articles' ? 'articles' : item?.kind === 'products' ? 'products' : '';
  if (!contentId || !kind) return { title: fallback, path: '/pages/index/index' };
  return { title: title(item.title || item.titleZh, fallback), path: `/pages/detail/index?kind=${kind}&id=${encodeURIComponent(contentId)}&share=${shareRef()}` };
}

export function publicMediaShare(kind, entry, fallback) {
  const contentId = id(entry?.id);
  const page = kind === 'salons' ? 'salons' : 'videos';
  return contentId
    ? { title: title(entry.titleZh, fallback), path: `/pages/${page}/index?id=${encodeURIComponent(contentId)}&share=${shareRef()}` }
    : { title: fallback, path: `/pages/${page}/index` };
}

export const homeShare = () => ({ title: '发现好内容', path: '/pages/index/index' });
