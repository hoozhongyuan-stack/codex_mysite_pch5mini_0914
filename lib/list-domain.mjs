export function listQuery(params) {
  const page = Number(params.get('page') || 1),
    size = Number(params.get('size') || 20);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000 ||
    ![20, 50, 100].includes(size)
  )
    throw Error('分页参数无效');
  const result = { page, size };
  for (const key of [
    'q',
    'category',
    'status',
    'form',
    'actor',
    'action',
    'module',
    'verified',
    'enabled',
    'from',
    'to',
    'sort',
  ]) {
    const value = (params.get(key) || '').trim();
    if (value.length > 200) throw Error('检索内容过长');
    result[key] = value;
  }
  for (const key of ['from', 'to'])
    if (
      result[key] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(result[key]) ||
        new Date(result[key]).toISOString().slice(0, 10) !== result[key])
    )
      throw Error('日期格式无效');
  if (result.from && result.to && result.from > result.to)
    throw Error('开始日期不能晚于结束日期');
  if (result.sort && !['asc', 'desc'].includes(result.sort))
    throw Error('排序无效');
  return result;
}
export function workflowInput(input) {
  if (!['pending', 'processing', 'done'].includes(input?.status))
    throw Error('处理状态无效');
  if (input.note != null && typeof input.note !== 'string')
    throw Error('备注格式无效');
  const note = (input.note || '').trim();
  if (note.length > 2000) throw Error('备注最多 2000 字');
  return { status: input.status, note };
}
export function csv(rows) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value ?? '');
            if (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s)) s = "'" + s;
            return '"' + s.replaceAll('"', '""') + '"';
          })
          .join(','),
      )
      .join('\r\n')
  );
}
export const actionLabels = {
  saveContent: '保存内容',
  deleteContent: '删除内容',
  saveCategory: '保存分类',
  deleteCategory: '删除分类',
  saveFolder: '保存文件夹',
  deleteFolder: '删除文件夹',
  moveAsset: '移动素材',
  upload: '上传素材',
  renameAsset: '重命名素材',
  deleteAsset: '删除素材',
  saveNav: '保存导航',
  deleteNav: '删除导航',
  saveAdmin: '更新管理员',
  savePolicy: '保存政策',
  saveSettings: '保存设置',
  saveFooter: '保存页脚',
  saveBrand: '保存品牌图标',
  markSubmission: '标为已读',
  updateSubmission: '处理表单',
  exportSubmissions: '导出表单',
  addEvidence: '记录引用证据',
  'save-smtp': '保存邮件配置',
  'test-smtp': '测试邮件',
  'save-user-profile': '修改访客资料',
  'social-save': '配置第三方登录',
  'set-user-enabled': '启停访客',
  'enable-user': '启用访客',
  'disable-user': '停用访客',
};
export const modules = {
  content: ['saveContent', 'deleteContent'],
  categories: ['saveCategory', 'deleteCategory'],
  assets: [
    'saveFolder',
    'deleteFolder',
    'moveAsset',
    'upload',
    'renameAsset',
    'deleteAsset',
  ],
  navigation: ['saveNav', 'deleteNav'],
  admins: ['saveAdmin'],
  policies: ['savePolicy'],
  settings: ['saveBrand', 'saveSettings', 'saveFooter', 'save-smtp', 'test-smtp'],
  submissions: ['markSubmission', 'updateSubmission', 'exportSubmissions'],
  geo: ['addEvidence'],
  users: ['set-user-enabled', 'enable-user', 'disable-user', 'save-user-profile', 'social-save'],
};
export function submissionEmail(data) {
  return (
    data.email ||
    (data.fields || [])
      .filter((f) => f.type === 'email')
      .map((f) => data.values?.[f.id])
      .filter(Boolean)
      .join('; ') ||
    ''
  );
}
