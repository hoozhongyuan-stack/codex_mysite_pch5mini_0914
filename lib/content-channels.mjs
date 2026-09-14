export function contentChannels(value) {
  if (value === undefined) return { website: true, mini: false };
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !['website', 'mini'].includes(k)) ||
    Object.values(value).some((v) => typeof v !== 'boolean')
  )
    throw Error('展示渠道格式无效');
  return { website: value.website !== false, mini: value.mini === true };
}
export function channelVisible(content, end) {
  return (
    content.status === 'published' &&
    contentChannels(content.channels)[end] === true
  );
}
