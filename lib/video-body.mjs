import {plainToRich, validateRich, richText} from './cms-domain.mjs';
export function videoBody(value) {
  const doc = validateRich(typeof value === 'string' || value == null ? plainToRich(value) : value);
  if (doc.type !== 'doc' || richText(doc).length > 10000) throw Error('视频详情文字不能超过10000字');
  return doc;
}
export function displayVideoBody(value) {
  try { return videoBody(value); } catch { return plainToRich(''); }
}
