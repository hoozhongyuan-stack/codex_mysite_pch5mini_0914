// Existing timestamps are retained; authenticated editors can explicitly backfill history.
export function publicationTime(previous, status, now, supplied, previousStatus) {
  if (supplied) {
    const parsed = Date.parse(supplied);
    if (typeof supplied !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(supplied) || !Number.isFinite(parsed) || parsed > Date.parse(now))
      throw Error('发布时间无效或晚于当前时间');
    return new Date(parsed).toISOString();
  }
  if (previous?.publishedAt) return previous.publishedAt;
  if (previousStatus === 'published') return null;
  return status === 'published' ? now : null;
}
