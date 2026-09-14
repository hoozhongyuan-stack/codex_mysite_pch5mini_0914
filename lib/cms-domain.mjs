import { text } from './domain.mjs';
export const fieldTypes = [
  'text',
  'textarea',
  'phone',
  'email',
  'image',
  'time',
  'date',
  'number',
];
export function validateCategory(v, all = []) {
  if (!['articles', 'products'].includes(v.kind)) throw Error('分类类型无效');
  const id = text(v.id, 80),
    parentId = text(v.parentId, 80);
  if (parentId) {
    const p = all.find((r) => r.id === parentId);
    if (
      !p ||
      p.kind !== v.kind ||
      p.parent_id ||
      parentId === id ||
      all.some((r) => r.parent_id === id)
    )
      throw Error('分类最多支持两级，且必须关联同类型的一级分类');
  }
  return {
    id,
    kind: v.kind,
    parentId,
    nameZh: text(v.nameZh, 80, true),
    nameEn: text(v.nameEn, 80, true),
  };
}
export function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length > 30)
    throw Error('表单最多支持30个项目');
  const ids = new Set();
  return fields.map((f) => {
    const id = text(f.id, 80, true);
    if (
      !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id) ||
      ids.has(id) ||
      !fieldTypes.includes(f.type)
    )
      throw Error('字段标识重复或类型无效');
    ids.add(id);
    const min = f.min === '' || f.min == null ? null : Number(f.min),
      max = f.max === '' || f.max == null ? null : Number(f.max);
    if (
      (min !== null && !Number.isFinite(min)) ||
      (max !== null && !Number.isFinite(max)) ||
      (min !== null && max !== null && min > max)
    )
      throw Error('数字范围无效');
    return {
      id,
      type: f.type,
      labelZh: text(f.labelZh, 100, true),
      labelEn: text(f.labelEn, 100, true),
      placeholderZh: text(f.placeholderZh, 150),
      placeholderEn: text(f.placeholderEn, 150),
      required: f.required === true,
      min,
      max,
    };
  });
}
export const legacyFields = [
  {
    id: 'name',
    type: 'text',
    labelZh: '姓名',
    labelEn: 'Name',
    required: true,
  },
  {
    id: 'email',
    type: 'email',
    labelZh: '邮箱',
    labelEn: 'Email',
    required: true,
  },
  {
    id: 'message',
    type: 'textarea',
    labelZh: '留言',
    labelEn: 'Message',
    required: true,
  },
];
export function validateValues(fields, values) {
  if (!values || typeof values !== 'object' || Array.isArray(values))
    throw Error('表单格式错误');
  return Object.fromEntries(
    fields.map((f) => {
      let v = text(
        values[f.id] === null ? '' : String(values[f.id] ?? ''),
        f.type === 'textarea' ? 6000 : 1000,
      );
      if (!v) {
        if (f.required) throw Error(`请填写${f.labelZh}`);
        return [f.id, ''];
      }
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        throw Error('邮箱格式无效');
      if (f.type === 'phone' && !/^\+?[0-9 ()-]{6,25}$/.test(v))
        throw Error('手机号格式无效');
      if (f.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
        throw Error('时间格式无效');
      if (
        f.type === 'date' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v)
      )
        throw Error('日期格式无效');
      if (f.type === 'number') {
        if (!/^-?\d+(\.\d+)?$/.test(v)) throw Error('请输入数字');
        v = Number(v);
        if (
          !Number.isFinite(v) ||
          (f.min != null && v < f.min) ||
          (f.max != null && v > f.max)
        )
          throw Error('数字超出范围');
      }
      if (f.type === 'image' && !/^[a-f0-9-]{36}$/.test(v))
        throw Error('请重新上传图片');
      return [f.id, v];
    }),
  );
}
const nodes = [
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  'hardBreak',
  'horizontalRule',
  'codeBlock',
  'image',
  'video',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
];
export function validateRich(doc) {
  let count = 0;
  function visit(n, depth = 0) {
    if (!n || !nodes.includes(n.type) || depth > 20 || ++count > 6000)
      throw Error('富文本结构无效或过大');
    if (n.type === 'text')
      return {
        type: 'text',
        text: typeof n.text === 'string' ? n.text : '',
        ...(n.marks
          ? {
              marks: n.marks.map((m) => {
                if (
                  ![
                    'bold',
                    'italic',
                    'strike',
                    'underline',
                    'code',
                    'link',
                  ].includes(m.type)
                )
                  throw Error('不支持的文字样式');
                if (m.type === 'link') {
                  const href = text(m.attrs?.href, 1500, true);
                  if (!/^(https?:\/\/|mailto:)/i.test(href))
                    throw Error('链接地址不安全');
                  return { type: 'link', attrs: { href } };
                }
                return { type: m.type };
              }),
            }
          : {}),
      };
    let attrs = {};
    if (n.type === 'heading')
      attrs = { level: [2, 3, 4].includes(n.attrs?.level) ? n.attrs.level : 2 };
    if (n.type === 'orderedList')
      attrs = {
        start: Math.max(1, Math.min(999, Number(n.attrs?.start) || 1)),
      };
    if (['image', 'video'].includes(n.type)) {
      const src = text(n.attrs?.src, 150, true);
      if (!/^\/api\/media\/[a-f0-9-]{36}$/.test(src))
        throw Error('请从素材库选择图片或视频');
      attrs = { src, alt: text(n.attrs?.alt, 200) };
    }
    if (['tableCell', 'tableHeader'].includes(n.type))
      attrs = {
        colspan: Math.max(1, Math.min(20, Number(n.attrs?.colspan) || 1)),
        rowspan: Math.max(1, Math.min(20, Number(n.attrs?.rowspan) || 1)),
      };
    if (n.content && !Array.isArray(n.content)) throw Error('富文本格式错误');
    return {
      type: n.type,
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(n.content
        ? { content: n.content.map((c) => visit(c, depth + 1)) }
        : {}),
    };
  }
  if (doc?.type !== 'doc') throw Error('富文本必须为文档');
  return visit(doc);
}
export function richText(doc) {
  return (doc?.content || [])
    .map((n) => (n.type === 'text' ? n.text : richText(n)))
    .join(doc?.type === 'paragraph' || doc?.type === 'heading' ? '' : '\n')
    .trim();
}
export function richAssets(doc) {
  return [
    ...new Set(
      (function walk(n) {
        return [
          ...(['image', 'video'].includes(n?.type)
            ? [n.attrs.src.split('/').pop()]
            : []),
          ...(n?.content || []).flatMap(walk),
        ];
      })(doc),
    ),
  ];
}
export function plainToRich(value) {
  return {
    type: 'doc',
    content: String(value || '')
      .split(/\n\s*\n/)
      .filter(Boolean)
      .map((p) => ({
        type: p.startsWith('## ') ? 'heading' : 'paragraph',
        ...(p.startsWith('## ') ? { attrs: { level: 2 } } : {}),
        content: [{ type: 'text', text: p.replace(/^## /, '') }],
      })),
  };
}
export function validateNav(v) {
  if (
    ![
      'articleCategory',
      'productCategory',
      'article',
      'product',
      'form',
      'event',
      'videoCatalog',
      'pointsMall',
    ].includes(v.targetType)
  )
    throw Error('导航关联类型无效');
  return {
    id: text(v.id, 80),
    labelZh: text(v.labelZh, 80, true),
    labelEn: text(v.labelEn, 80, true),
    targetType: v.targetType,
    targetId: text(v.targetId, 80, true),
    enabled: v.enabled !== false,
    sort: Math.max(0, Math.min(9999, Number(v.sort) || 0)),
  };
}
export function permission(role, action) {
  if (role === 'owner') return true;
  if (role === 'editor')
    return [
      'readContent',
      'saveContent',
      'deleteContent',
      'saveCategory',
      'deleteCategory',
      'saveFolder',
      'deleteFolder',
      'moveAsset',
      'renameAsset',
      'deleteAsset',
      'upload',
      'readAssets',
    ].includes(action);
  return false;
}
export function validatePolicy(v) {
  if (
    !['terms', 'privacy', 'cookies'].includes(v.kind) ||
    !['draft', 'published'].includes(v.status)
  )
    throw Error('政策类型或状态无效');
  return {
    kind: v.kind,
    status: v.status,
    titleZh: text(v.titleZh, 120, true),
    titleEn: text(v.titleEn, 120, true),
    bodyZh: text(v.bodyZh, 30000, v.status === 'published'),
    bodyEn: text(v.bodyEn, 30000, v.status === 'published'),
  };
}
