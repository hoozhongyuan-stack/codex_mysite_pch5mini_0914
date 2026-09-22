export const miniTargets = [
  ['home', '首页'],
  ['products', '商城'],
  ['articles', '文章'],
  ['events', '沙龙会'],
  ['cart', '购物车'],
  ['videos', '视频'],
  ['points', '积分商城'],
  ['account', '个人中心'],
  ['microPage', '微页面'],
];
const staticMiniTargets = miniTargets.filter(([key]) => key !== 'microPage');
const str = (v, max = 100) => {
  if (v == null) return '';
  if (typeof v !== 'string' || v.length > max)
    throw Error('内容格式或长度无效');
  return v.trim();
};
const list = (v, max) => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > max) throw Error('条目数量超限');
  return v;
};
const id = (v) => {
  const s = str(v, 80);
  if (s && !/^[a-zA-Z0-9_-]+$/.test(s)) throw Error('素材或内容标识无效');
  return s;
};
const newId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2)
  ).replace(/[^a-zA-Z0-9_-]/g, '-');
export const detailTargetKinds = {product:'products',article:'articles',form:'forms',video:'videos',event:'events',microPage:'microPages'};
export const hotspotTargets = [...miniTargets,['product','商品详情'],['article','文章详情'],['video','视频系列'],['event','沙龙会详情'],['form','表单']];
const target = (v) => {
  if (!staticMiniTargets.some(([k]) => k === v)) throw Error('请选择已有小程序页面');
  return v;
};

function navLink(v, draft) {
  const nextTarget = v.target === 'salons' ? 'events' : v.target;
  if (!miniTargets.some(([key]) => key === nextTarget)) throw Error('请选择已有小程序页面');
  const contentId = nextTarget === 'microPage' ? id(v.contentId) : '';
  if (nextTarget === 'microPage' && !contentId && !draft) throw Error('请选择关联内容');
  return { target: nextTarget, contentId };
}
function link(v, draft) {
 const nextTarget = v.target === 'salons' ? 'events' : v.target;
 if (!hotspotTargets.some(([key])=>key===nextTarget)) throw Error('链接目标无效');
 const contentId = detailTargetKinds[nextTarget] ? id(v.contentId) : '';
 if (detailTargetKinds[nextTarget] && !contentId && !draft) throw Error('请选择关联内容');
 return {target:nextTarget,contentId};
}
function optionalLink(v, draft) {
  if (!v?.target) return { target: '', contentId: '' };
  return link(v, draft);
}
function linkKey(v) {
  return `${v.target || ''}:${v.contentId || ''}`;
}
function hotspotImage(v, draft = false) {
  const imageId = id(v.imageId);
  if (!imageId) throw Error('请选择热区图片');
  const zones = list(v.zones,20).map(z => {
    const {x,y,width,height} = z;
    if (![x,y,width,height].every(Number.isFinite) || x<0 || y<0 || width<=0 || height<=0 || x+width>100 || y+height>100) throw Error('热区必须位于图片范围内');
    const {target,contentId} = link(z,draft);
    const label = str(z.label,40);
    if (!label) throw Error('请填写热区名称');
    return {label,x,y,width,height,target,contentId};
  });
  return {imageId,zones};
}
function homeComponent(v = {}, draft = false) {
  const type = v.type;
  const idValue = id(v.id) || newId();
  if (!['search', 'notice', 'divider', 'banners', 'hotspots', 'productFloor'].includes(type)) throw Error('首页组件类型无效');
  const base = { id: idValue, type, enabled: v.enabled !== false };
  if (type === 'search') {
    const scope = ['products','articles','videos','events','points'].includes(v.scope) ? v.scope : 'products';
    return { ...base, placeholder: str(v.placeholder || '搜索内容', 24), scope };
  }
  if (type === 'notice') {
    const text = str(v.text || '公告内容', 80);
    if (!draft && !text) throw Error('请填写公告内容');
    return { ...base, text, ...optionalLink(v, draft) };
  }
  if (type === 'divider') return { ...base, style: ['line','dashed','space'].includes(v.style) ? v.style : 'line' };
  if (type === 'banners') {
    const items = list(v.items, 5).map((row) => ({ imageId: id(row.imageId), title: str(row.title, 60), ...link(row, draft) }));
    if (!draft && items.some((row) => !row.imageId)) throw Error('请选择轮播图片');
    return { ...base, items };
  }
  if (type === 'hotspots') return { ...base, items: list(v.items, 10).map((row) => hotspotImage(row, draft)) };
  return { ...base, title: str(v.title || '精选商品', 24), productIds: [...new Set(list(v.productIds, 12).map(id))] };
}
function validateNotificationCenter(v = {}) {
  const template = (row = {}) => ({ enabled: row.enabled === true, templateId: id(row.templateId), note: str(row.note, 80) });
  return {
    enabled: v.enabled === true,
    templates: {
      order: template(v.templates?.order),
      event: template(v.templates?.event),
      points: template(v.templates?.points),
    },
    triggers: {
      orderPaid: v.triggers?.orderPaid === true,
      orderShipped: v.triggers?.orderShipped === true,
      eventRegistered: v.triggers?.eventRegistered === true,
      eventChanged: v.triggers?.eventChanged === true,
      pointsChanged: v.triggers?.pointsChanged === true,
    },
  };
}
function microPage(v = {}, draft = false) {
  const pageId = id(v.id) || newId();
  const title = str(v.title || '新微页面', 40);
  if (!draft && !title) throw Error('请填写微页面标题');
  const status = ['draft','published','archived'].includes(v.status) ? v.status : 'draft';
  return {
    id: pageId,
    title,
    description: str(v.description, 120),
    status,
    components: list(v.components, 50).map((row) => homeComponent(row, draft)),
  };
}
export function validateMini(v = {}, {draft = false} = {}) {
  const appId = str(v.appId, 18),
    apiOrigin = str(v.apiOrigin, 200);
  if (appId && !/^wx[a-fA-F0-9]{16}$/.test(appId))
    throw Error('AppID 格式无效');
  if (apiOrigin) {
    let u;
    try {
      u = new URL(apiOrigin);
    } catch {
      throw Error('API 地址无效');
    }
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.pathname !== '/' ||
      u.search ||
      u.hash
    )
      throw Error('API 地址须为不带路径的 HTTPS 域名');
  }
  const items = list(v.navigation?.items, 10).map((n) => ({
    label: str(n.label, 12),
    ...navLink(n, draft),
    iconId: id(n.iconId),
    selectedIconId: id(n.selectedIconId),
    enabled: n.enabled !== false,
  }));
  if (items.some((n) => !n.label)) throw Error('请填写导航名称');
  const active = items.filter((n) => n.enabled);
  if (new Set(items.map(linkKey)).size !== items.length)
    throw Error('导航目标不能重复');
  if (
    v.navigation?.enabled === true &&
    (active.length < 2 || active.length > 5)
  )
    throw Error('底部导航启用时需要2—5项');
  const banners = list(v.banners, 5).map((n) => ({
    imageId: id(n.imageId),
    title: str(n.title, 60),
    ...link(n,draft),
  }));
  if (!draft && banners.some((n) => !n.imageId)) throw Error('请选择轮播图片');
  const featuredIds = list(v.featuredIds, 12).map(id);
  const productFloor = {
    enabled: v.productFloor?.enabled !== false,
    title: str(v.productFloor?.title || '精选商品', 24),
  };
  const notificationCenter = validateNotificationCenter(v.notificationCenter);
  const homeComponents = list(v.homeComponents, 30).map((row) => homeComponent(row, draft));
  const microPages = list(v.microPages, 100).map((row) => microPage(row, draft));
  if (new Set(microPages.map((row) => row.id)).size !== microPages.length) throw Error('微页面不能重复');
  const publishedMicroIds = new Set(microPages.filter((row) => row.status === 'published').map((row) => row.id));
  const linkedMicroIds = [
    ...items,
    ...banners,
    ...list(v.hotspotImages,10).flatMap((b) => list(b.zones,20)),
    ...homeComponents,
    ...microPages.flatMap((p) => p.components),
    ...homeComponents.flatMap((c) => c.type === 'banners' ? c.items : c.type === 'hotspots' ? c.items.flatMap((b) => b.zones) : []),
    ...microPages.flatMap((p) => p.components.flatMap((c) => c.type === 'banners' ? c.items : c.type === 'hotspots' ? c.items.flatMap((b) => b.zones) : [])),
  ].filter((row) => row.target === 'microPage').map((row) => row.contentId).filter(Boolean);
  if (!draft && linkedMicroIds.some((value) => !publishedMicroIds.has(value))) throw Error('请选择已发布微页面');
  return {
    appId,
    apiOrigin: apiOrigin ? new URL(apiOrigin).origin : '',
    navigation: { enabled: v.navigation?.enabled === true, items },
    banners,
    hotspotImages: list(v.hotspotImages,10).map(b=>hotspotImage(b,draft)),
    featuredIds: [...new Set(featuredIds)],
    productFloor,
    homeComponents,
    microPages,
    notificationCenter,
    title: str(v.title, 60),
    description: str(v.description, 200),
  };
}
export function validateFloating(value) {
  const rows = list(value, 9).map((e) => {
    const kind = e.kind;
    if (!['image', 'phone', 'form'].includes(kind))
      throw Error('悬浮入口类型无效');
    const ends = [...new Set(list(e.ends, 3))];
    if (ends.some((k) => !['pc', 'h5', 'mini'].includes(k)))
      throw Error('展示端无效');
    const pages = list(e.pages, 30).map((p) => str(p, 200));
    if (pages.some((p) => !/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(p)))
      throw Error('页面范围请填写站内路径，不含语言前缀');
    const r = {
      id: id(e.id),
      labelZh: str(e.labelZh, 24),
      labelEn: str(e.labelEn, 40),
      kind,
      icon: ['message', 'phone', 'image', 'form'].includes(e.icon)
        ? e.icon
        : kind,
      iconId: id(e.iconId),
      imageId: kind === 'image' ? id(e.imageId) : '',
      formId: kind === 'form' ? id(e.formId) : '',
      phone: kind === 'phone' ? str(e.phone, 30) : '',
      enabled: e.enabled === true,
      ends,
      pages,
    };
    if (!r.id || !r.labelZh) throw Error('请填写入口名称');
    if (kind === 'phone' && !/^\+?[0-9 ()-]{3,30}$/.test(r.phone))
      throw Error('电话号码无效');
    if ((kind === 'image' && !r.imageId) || (kind === 'form' && !r.formId))
      throw Error('请选择关联图片或表单');
    return r;
  });
  if (new Set(rows.map((r) => r.id)).size !== rows.length)
    throw Error('入口不能重复');
  for (const end of ['pc', 'h5', 'mini'])
    if (rows.filter((r) => r.enabled && r.ends.includes(end)).length > 3)
      throw Error('每端最多启用3个悬浮入口');
  return rows;
}
export function channelAssetIds(mini, floating) {
  return [
    ...new Set(
      [
        ...mini.navigation.items.flatMap((n) => [n.iconId, n.selectedIconId]),
        ...mini.banners.map((b) => b.imageId),
        ...(mini.hotspotImages || []).map(b => b.imageId),
        ...(mini.homeComponents || []).flatMap((c) => c.type === 'banners' ? c.items.map((b) => b.imageId) : c.type === 'hotspots' ? c.items.map((b) => b.imageId) : []),
        ...(mini.microPages || []).flatMap((p) => (p.components || []).flatMap((c) => c.type === 'banners' ? c.items.map((b) => b.imageId) : c.type === 'hotspots' ? c.items.map((b) => b.imageId) : [])),
        ...floating.flatMap((r) => [r.iconId, r.imageId]),
      ].filter(Boolean),
    ),
  ];
}
export function channelTransition(old, section, value, action) {
  const empty = { mini: validateMini(), floating: [] };
  const draft = { ...(old.draft || empty), [section]: value };
  if (action === 'save') return { ...old, draft };
  return {
    ...old,
    draft,
    published: { ...(old.published || empty), [section]: value },
    previous: {
      ...(old.previous || empty),
      [section]: old.published?.[section] || empty[section],
    },
    publishedAt: new Date().toISOString(),
  };
}

export const miniReadyTargets = miniTargets.map(([key])=>key);
export function checkMiniCapabilities(mini) {
 const componentLinks=(components=[])=>components.flatMap(c=>c.type==='banners'?(c.items||[]):c.type==='hotspots'?(c.items||[]).flatMap(b=>b.zones||[]):[c]);
 const used = [...(mini.navigation.enabled ? mini.navigation.items.filter(i=>i.enabled) : []), ...mini.banners, ...(mini.hotspotImages||[]).flatMap(b=>b.zones), ...componentLinks(mini.homeComponents||[]), ...(mini.microPages||[]).flatMap(p=>componentLinks(p.components||[]))].filter(v=>v.target);
 if (used.some(v=>!hotspotTargets.some(([key])=>key===v.target))) throw Error('当前版本不支持此链接');
}
