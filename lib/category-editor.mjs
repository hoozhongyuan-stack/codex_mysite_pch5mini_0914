/** Normalize the API database field and unsaved editor payload at one boundary. */
function parentId(row) {
  return Object.hasOwn(row, 'parent_id') ? row.parent_id || '' : row.parentId || '';
}
export function categoryEditDraft(row) {
  return { ...row, parentId: parentId(row) };
}
export function categoryParentOptions(rows, kind, currentId = '') {
  const options = [['', '无，作为一级分类']];
  if (currentId && rows.some(row => parentId(row) === currentId)) return options;
  return [...options, ...rows.filter(row => row.kind === kind && !parentId(row) && row.id !== currentId)
    .map(row => [row.id, row.nameZh])];
}
export function categoryTreeRows(rows, kind, collapsed = []) {
  const typed = rows.filter(row => row.kind === kind).map(row => ({ ...row, parent_id: parentId(row) || null }));
  return typed.filter(row => !row.parent_id).flatMap(row => [row,
    ...(collapsed.includes(row.id) ? [] : typed.filter(child => child.parent_id === row.id)),
  ]);
}
