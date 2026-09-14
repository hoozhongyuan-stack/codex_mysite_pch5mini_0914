export const EVENTS = [
  'page_view',
  'article_read',
  'video_start',
  'video_valid',
  'video_complete',
  'favorite',
  'cart_add',
  'checkout_start',
  'order_submit',
];
const idPattern = /^[a-zA-Z0-9_-]{16,80}$/;
export function normalizeEvent(input, channel) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (k) =>
        ![
          'id',
          'visitorId',
          'sessionId',
          'event',
          'path',
          'target',
          'consent',
          'channel',
        ].includes(k),
    ) ||
    input.consent !== true ||
    input.channel !== channel ||
    !EVENTS.includes(input.event) ||
    ![input.id, input.visitorId, input.sessionId].every(
      (v) => typeof v === 'string' && idPattern.test(v),
    )
  )
    throw Error('行为事件无效');
  if (
    typeof input.path !== 'string' ||
    input.path.length > 500 ||
    !/^\/(?!\/)/.test(input.path)
  )
    throw Error('路径无效');
  let path = input.path.split(/[?#]/)[0];
  if (!/^\/[\w\-/]*$/.test(path)) throw Error('路径无效');
  // Account/order paths may contain private identifiers; store only the route family.
  path = path.replace(
    /(\/(?:orders?|account|checkout|form|login))(?:\/.*)?$/,
    '$1',
  );
  const privatePath = /\/(?:orders?|account|checkout|form|login)(?:\/|$)/.test(
    path,
  );
  const target = privatePath ? '' : input.target || '';
  if (
    typeof target !== 'string' ||
    target.length > 100 ||
    !/^[\w-]*$/.test(target)
  )
    throw Error('内容标识无效');
  return {
    id: input.id,
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    event: input.event,
    path,
    target,
    channel,
  };
}
const unique = (rows, key) => new Set(rows.map(key)).size;
export function summarizeBehavior(rows) {
  const visitors = unique(rows, (r) => r.channel + ':' + r.visitor_hash);
  const sessions = new Map();
  for (const r of [...rows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )) {
    const key = r.channel + ':' + r.session_hash;
    sessions.set(key, [...(sessions.get(key) || []), r]);
  }
  // Direct purchase is a valid alternative to adding to cart; separate funnel below.
  const funnelFor = (steps) =>
    steps.map((event, index) => ({
      event,
      count: [...sessions.values()].filter((events) => {
        let stage = 0;
        for (const r of events) if (r.event === steps[stage]) stage++;
        return stage > index;
      }).length,
    }));
  const ranking = (event) => {
    const targets = new Map();
    for (const r of rows)
      if (r.event === event && r.target) {
        const set = targets.get(r.target) || new Set();
        set.add(r.channel + ':' + r.session_hash);
        targets.set(r.target, set);
      }
    return [...targets]
      .map(([target, seen]) => ({ target, count: seen.size }))
      .sort((a, b) => b.count - a.count || a.target.localeCompare(b.target))
      .slice(0, 10);
  };
  const video = new Map();
  for (const r of [...rows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  )) {
    const key = r.channel + ':' + r.session_hash + ':' + r.target;
    if (r.event === 'video_start') video.set(key, video.get(key) || new Set());
    else if (
      ['video_valid', 'video_complete'].includes(r.event) &&
      video.has(key)
    )
      video.get(key).add(r.event);
  }
  const validVideo = (event) =>
    [...video.values()].filter((events) => events.has(event)).length;
  const videoStarts = video.size;
  return {
    visitors,
    sessions: sessions.size,
    views: rows.filter((r) => r.event === 'page_view').length,
    articleReads: rows.filter((r) => r.event === 'article_read').length,
    favorites: rows.filter((r) => r.event === 'favorite').length,
    cartAdds: rows.filter((r) => r.event === 'cart_add').length,
    submissions: rows.filter((r) => r.event === 'order_submit').length,
    videoStarts,
    videoValid: validVideo('video_valid'),
    videoComplete: validVideo('video_complete'),
    articles: ranking('article_read'),
    videos: ranking('video_valid'),
    funnel: funnelFor([
      'page_view',
      'cart_add',
      'checkout_start',
      'order_submit',
    ]),
    directFunnel: funnelFor(['page_view', 'checkout_start', 'order_submit']),
  };
}
