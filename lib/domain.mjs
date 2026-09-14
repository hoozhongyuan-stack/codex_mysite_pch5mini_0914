import {contentChannels} from './content-channels.mjs';
import { validateTrade } from './product-options.mjs';
import { validateRich, richText, richAssets, validateFields } from './cms-domain.mjs';
export function text(value, max = 200, required = false) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s.length > max || (required && !s))
    throw new Error('请填写必填项，并检查文字长度');
  return s;
}
export function validateContent(input) {
  if (!input || !['articles', 'products', 'forms'].includes(input.kind))
    throw new Error('内容类型不正确');
  const slug = text(input.slug, 80, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error('链接仅支持小写字母、数字和连字符');
  if (!['draft', 'published'].includes(input.status))
    throw new Error('发布状态不正确');
  const imageIds =
    input.kind === 'products'
      ? (input.imageIds ?? (input.imageId ? [input.imageId] : []))
      : [];
  if (
    !Array.isArray(imageIds) ||
    imageIds.length > 10 ||
    imageIds.some((id) => typeof id !== 'string' || !id || id.length > 80) ||
    new Set(imageIds).size !== imageIds.length
  )
    throw Error('商品主图最多10张，且不能重复');
  const required = input.status === 'published';
  const fieldText = (value, max, mandatory, label) => {
    const valueText = typeof value === 'string' ? value.trim() : '';
    if (mandatory && !valueText) throw Error(`${label}不能为空`);
    if (Array.from(valueText).length > max) throw Error(`${label}超过${max}字，请缩短文字内容（图片不计入字数）`);
    return valueText;
  };
  const richZh = input.richZh ? validateRich(input.richZh) : null,
    richEn = input.richEn ? validateRich(input.richEn) : null;
  return {
    kind: input.kind,
    slug,
    status: input.status,
    channels: contentChannels(input.channels),
    titleZh: fieldText(input.titleZh, 160, true, '中文标题'),
    titleEn: fieldText(input.titleEn, 160, required, '英文标题'),
    summaryZh: fieldText(input.summaryZh, 500, required, '中文摘要'),
    summaryEn: fieldText(input.summaryEn, 500, required, '英文摘要'),
    bodyZh: fieldText(
      richZh ? richText(richZh) : input.bodyZh,
      30000,
      required && input.kind !== 'forms' && !(richZh && richAssets(richZh).length),
      '中文正文',
    ),
    bodyEn: fieldText(
      richEn ? richText(richEn) : input.bodyEn,
      30000,
      required && input.kind !== 'forms' && !(richEn && richAssets(richEn).length),
      '英文正文',
    ),
    richZh,
    richEn,
    categoryId: text(input.categoryId, 80),
    ...(input.kind !== 'forms'
      ? { linkedFormId: text(input.linkedFormId, 80) }
      : {}),
    ...(input.kind === 'forms' && input.fields !== undefined
      ? { fields: validateFields(input.fields) }
      : {}),
    imageId:
      input.kind === 'products' ? imageIds[0] || '' : text(input.imageId, 80),
    ...(input.kind === 'products'
      ? {
          imageIds,
          spu: text(input.spu, 80),
          trade: validateTrade(input.trade, required),
        }
      : {}),
    category: text(input.category, 50),
    author: text(input.author, 100),
    sourceUrl: validateUrl(input.sourceUrl),
    id: text(input.id, 80),
  };
}
export function validateUrl(value) {
  const s = text(value, 1500);
  if (!s) return '';
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('请输入完整的 HTTPS 链接');
  }
  if (u.protocol !== 'https:') throw new Error('仅支持 HTTPS 链接');
  return u.href;
}
export function validateSubmission(input) {
  const email = text(input.email, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('请填写有效邮箱');
  if (input.consent !== true) throw new Error('请同意使用联系信息处理本次咨询');
  return {
    name: text(input.name, 100, true),
    email,
    message: text(input.message, 6000, true),
    formId: text(input.formId, 80, true),
    language: input.language === 'en' ? 'en' : 'zh',
  };
}
export function validateSettings(input) {
  if (!['tech', 'minimal', 'editorial'].includes(input.theme))
    throw new Error('请选择有效主题');
  return {
    theme: input.theme,
    nameZh: text(input.nameZh, 100, true),
    nameEn: text(input.nameEn, 100, true),
    descriptionZh: text(input.descriptionZh, 800),
    descriptionEn: text(input.descriptionEn, 800),
    contactEmail: text(input.contactEmail, 254),
    heroZh: text(input.heroZh, 160),
    heroEn: text(input.heroEn, 160),
  };
}
export function classifyVisit(ua, ref) {
  const bot = String(ua).match(
    /GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|PerplexityBot|Google-Extended|Bingbot/i,
  );
  if (bot) return { kind: 'claimed_bot', source: bot[0] };
  try {
    const host = new URL(ref).hostname;
    if (
      [
        'chatgpt.com',
        'perplexity.ai',
        'www.perplexity.ai',
        'claude.ai',
        'gemini.google.com',
      ].includes(host)
    )
      return { kind: 'ai_referral', source: host };
  } catch {}
  return { kind: 'other', source: '' };
}
export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
export function allowedAdmin(email, allowlist, isDev) {
  return (
    Boolean(email) &&
    ((isDev && email === 'seedy@sites.test') ||
      allowlist
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .includes(email.toLowerCase()))
  );
}
export function validMedia(mime, size) {
  return (
    [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
    ].includes(mime) &&
    size > 0 &&
    size <= 30 * 1024 * 1024
  );
}
