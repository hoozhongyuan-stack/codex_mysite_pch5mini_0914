const clean = (v, max = 200) => {
  if (v == null) return '';
  if (typeof v !== 'string' || v.length > max)
    throw Error('页脚内容格式或长度无效');
  return v.trim();
};
const url = (v) => {
  const s = clean(v, 1500);
  if (!s) return '';
  let u;
  try {
    u = new URL(s);
  } catch {
    throw Error('请填写完整 HTTPS 链接');
  }
  if (u.protocol !== 'https:' || u.username || u.password)
    throw Error('链接仅支持 HTTPS，不能包含账号密码');
  return u.href;
};
const entries = (v, max) => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > max) throw Error('页脚条目数量超限');
  return v;
};
const asset = (v) => {
  const s = clean(v, 80);
  if (s && !/^[a-f0-9]{8}-[a-f0-9-]{27}$/.test(s))
    throw Error('请从素材库选择图片');
  return s;
};
export const socialPlatforms = [
  'wechat',
  'linkedin',
  'facebook',
  'whatsapp',
  'instagram',
  'youtube',
  'x',
  'custom',
];
export function validateFooter(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v))
    throw Error('页脚设置无效');
  const result = {};
  for (const k of [
    'brandZh',
    'brandEn',
    'companyZh',
    'companyEn',
    'addressZh',
    'addressEn',
    'phone',
    'email',
    'copyrightZh',
    'copyrightEn',
    'year',
  ])
    result[k] = clean(v[k], k.startsWith('address') ? 500 : 200);
  for (const k of ['descriptionZh', 'descriptionEn'])
    result[k] = clean(v[k], 800);
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw Error('邮箱格式无效');
  if (result.phone && !/^[+\d ()#.-]{3,60}$/.test(result.phone))
    throw Error('联系电话格式无效');
  if (result.year && !/^\d{4}(?:[–-]\d{4})?$/.test(result.year))
    throw Error('年份请填写 2026 或 2020–2026');
  result.logoId = asset(v.logoId);
  result.copyrightUrl = url(v.copyrightUrl);
  result.navIds = [
    ...new Set(
      entries(v.navIds, 12)
        .map((s) => clean(s, 80))
        .filter(Boolean),
    ),
  ];
  result.policyKinds = [
    ...new Set(
      entries(
        v.policyKinds === undefined
          ? ['terms', 'privacy', 'cookies']
          : v.policyKinds,
        3,
      ),
    ),
  ];
  if (
    result.policyKinds.some((s) => !['terms', 'privacy', 'cookies'].includes(s))
  )
    throw Error('政策类型无效');
  result.registrations = entries(v.registrations, 4).map((r) => {
    const label = clean(r.label, 120),
      link = url(r.url);
    if (!label || !link) throw Error('请填写备案号和链接');
    return { label, url: link };
  });
  result.socials = entries(v.socials, 12).map((s) => {
    const platform = socialPlatforms.includes(s.platform)
      ? s.platform
      : 'custom';
    if (!['qr', 'link'].includes(s.kind)) throw Error('社交方式类型无效');
    const item = {
      platform,
      icon: ['globe', 'message', 'camera', 'video'].includes(s.icon)
        ? s.icon
        : 'globe',
      kind: s.kind,
      labelZh: clean(s.labelZh, 60),
      labelEn: clean(s.labelEn, 60),
      enabled: s.enabled !== false,
      url: s.kind === 'link' ? url(s.url) : '',
      imageId: s.kind === 'qr' ? asset(s.imageId) : '',
    };
    if (!item.labelZh || !item.labelEn || !(item.url || item.imageId))
      throw Error('请填写社交名称并配置链接或二维码');
    return item;
  });
  return result;
}
export function footerAssetIds(f) {
  return [
    ...new Set(
      [
        f?.logoId,
        ...(f?.socials || [])
          .filter((s) => s.enabled && s.kind === 'qr')
          .map((s) => s.imageId),
      ].filter(Boolean),
    ),
  ];
}
