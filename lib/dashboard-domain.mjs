const DAY = 86400000;
export function period(q) {
  const parse = (v) => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(v || '') ||
      new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v
    )
      throw Error('日期无效');
    return Date.parse(v + 'T00:00:00+08:00');
  };
  const a = parse(q.start),
    b = parse(q.end),
    days = (b - a) / DAY;
  if (days < 1 || days > 90) throw Error('请选择1至90天');
  return {
    start: q.start,
    end: q.end,
    days,
    startAt: new Date(a).toISOString(),
    endAt: new Date(b).toISOString(),
    previousStart: new Date(a - (b - a)).toISOString(),
  };
}
export const sourceChannel = (v) =>
  v === 'mini'
    ? 'mini'
    : ['pc', 'h5', 'web', 'website'].includes(v)
      ? 'website'
      : 'unknown';
export const within = (date, a, b) =>
  Date.parse(date) >= Date.parse(a) && Date.parse(date) < Date.parse(b);
export function series(rows, p) {
  return Array.from({ length: p.days }, (_, i) => {
    const a = Date.parse(p.startAt) + i * DAY,
      b = a + DAY;
    return {
      date: new Date(a + 8 * 3600000).toISOString().slice(0, 10),
      count: rows.filter(
        (r) => Date.parse(r.created_at) >= a && Date.parse(r.created_at) < b,
      ).length,
    };
  });
}
export function counts(rows, p) {
  return {
    available: true,
    current: rows.filter((r) => within(r.created_at, p.startAt, p.endAt))
      .length,
    previous: rows.filter((r) =>
      within(r.created_at, p.previousStart, p.startAt),
    ).length,
    daily: series(rows, p),
  };
}
export function summarizeTrade(orders, refunds, p) {
  const cash = orders.filter((o) => o.currency !== 'PTS');
  const paid = cash
    .filter((o) => o.first_paid)
    .map((o) => ({ ...o, created_at: o.first_paid }));
  const currencies = [
    ...new Set(
      [...cash, ...refunds].map((o) => o.currency).filter((c) => c !== 'PTS'),
    ),
  ].sort();
  return {
    ...counts(paid, p),
    money: currencies.map((currency) => ({
      currency,
      previousReceived: paid
        .filter(
          (o) =>
            o.currency === currency &&
            within(o.created_at, p.previousStart, p.startAt),
        )
        .reduce((s, o) => s + Number(o.total), 0),
      received: paid
        .filter(
          (o) =>
            o.currency === currency && within(o.created_at, p.startAt, p.endAt),
        )
        .reduce((s, o) => s + Number(o.total), 0),
      refunded: refunds
        .filter(
          (o) =>
            o.currency === currency && within(o.created_at, p.startAt, p.endAt),
        )
        .reduce((s, o) => s + Number(o.amount), 0),
    })),
  };
}
export const delta = (now, before) =>
  before === 0
    ? now === 0
      ? '持平'
      : '新增'
    : (((now - before) / before) * 100).toFixed(1) + '%';
