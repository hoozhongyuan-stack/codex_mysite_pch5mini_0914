export const IMAGE_VARIANTS = Object.freeze({
  thumb: { width: 320, quality: 72 },
  card: { width: 750, quality: 78 },
  hero: { width: 1440, quality: 82 },
});

export function imageVariant(value) {
  return typeof value === 'string' && Object.hasOwn(IMAGE_VARIANTS, value)
    ? value
    : '';
}

export function imageVariantKey(assetId, variant) {
  if (!/^[\w-]{1,100}$/.test(assetId) || !imageVariant(variant))
    throw Error('图片版本无效');
  return `image-variants/${assetId}/${variant}.webp`;
}
