export function validateBrand(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.showName !== 'boolean'
  )
    throw Error('品牌设置格式无效');
  const id = (value) => {
    if (
      typeof value !== 'string' ||
      value.length > 100 ||
      !/^[\w-]*$/.test(value)
    )
      throw Error('请选择有效素材');
    return value;
  };
  return {
    logoId: id(input.logoId),
    faviconId: id(input.faviconId),
    showName: input.showName,
  };
}
export function brandAssetIds(brand) {
  return [brand?.logoId, brand?.faviconId].filter(Boolean);
}
