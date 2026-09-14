export function catalogPage(
  all,
  categories,
  kind,
  query = {},
  lang = 'zh',
  initialCategory = '',
) {
  const value = (key) => (typeof query[key] === 'string' ? query[key] : '');
  const q = value('q').trim().slice(0, 150).toLowerCase();
  const category = Object.hasOwn(query, 'category')
    ? value('category')
    : initialCategory;
  const currencies = [
    ...new Set(
      all
        .filter((r) => r.kind === kind)
        .map((r) => r.trade?.currency)
        .filter(Boolean),
    ),
  ].sort();
  const currency = currencies.includes(value('currency'))
    ? value('currency')
    : currencies.length === 1
      ? currencies[0]
      : '';
  const allowed =
    kind === 'products'
      ? ['default', 'latest', 'priceAsc', 'priceDesc']
      : ['default', 'latest', 'earliest'];
  let sort = allowed.includes(value('sort')) ? value('sort') : 'default';
  if (sort.startsWith('price') && !currency) sort = 'default';
  const ids = new Set([
    category,
    ...categories.filter((c) => c.parent_id === category).map((c) => c.id),
  ]);
  const price = (r) => {
    const values = (r.trade?.variants || [])
      .filter((v) => v.enabled && Number.isSafeInteger(v.priceMinor))
      .map((v) => v.priceMinor);
    return values.length ? Math.min(...values) : null;
  };
  const rows = all.filter(
    (r) =>
      r.kind === kind &&
      (!category || ids.has(r.categoryId)) &&
      (!q ||
        [
          r['title' + (lang === 'en' ? 'En' : 'Zh')],
          r['summary' + (lang === 'en' ? 'En' : 'Zh')],
          r.spu,
        ].some((v) =>
          String(v || '')
            .toLowerCase()
            .includes(q),
        )) &&
      (!currency || r.trade?.currency === currency) &&
      (value('stock') !== '1' ||
        r.trade?.stockStatus === 'in' ||
        r.trade?.inventory > 0),
  );
  rows.sort((a, b) => {
    if (sort.startsWith('price')) {
      const x = price(a),
        y = price(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      if (x !== y) return sort === 'priceAsc' ? x - y : y - x;
    }
    return (
      (sort === 'earliest' ? 1 : -1) *
        String(a.createdAt || a.updatedAt || '').localeCompare(
          String(b.createdAt || b.updatedAt || ''),
        ) || String(a.id).localeCompare(String(b.id))
    );
  });
  const pages = Math.max(1, Math.ceil(rows.length / 12)),
    page = Math.min(pages, Math.max(1, Math.floor(Number(value('page')) || 1)));
  return {
    rows: rows.slice((page - 1) * 12, page * 12),
    total: rows.length,
    pages,
    page,
    category,
    q,
    sort,
    currency,
    currencies,
  };
}
