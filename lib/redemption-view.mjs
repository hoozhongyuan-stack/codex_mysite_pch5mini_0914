export function redemptionDetailHref(lang, slug) {
  return `/${lang === 'en' ? 'en' : 'zh'}/products/${encodeURIComponent(slug)}?purchase=points`;
}
export function redemptionPoints(row, key = '') {
  const variants = (row?.variants || []).filter(
    (v) =>
      v.enabled !== false &&
      Number.isInteger(v.pointsPrice) &&
      v.pointsPrice > 0,
  );
  if (key) return variants.find((v) => v.key === key)?.pointsPrice ?? null;
  return variants.length
    ? Math.min(...variants.map((v) => v.pointsPrice))
    : null;
}
