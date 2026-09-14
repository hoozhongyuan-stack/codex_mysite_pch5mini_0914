/** Shared boundaries for explicit, current-page admin selections. */
export function selectedIds(value) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 100 ||
    value.some((id) => typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id)) ||
    new Set(value).size !== value.length
  )
    throw Error('请选择1至100条不重复的记录');
  return [...value];
}
export function orderExportFilter(input) {
  const clauses = ['sandbox=?', 'status<>?'],
    args = [input.sandbox === true ? 1 : 0, 'building'];
  if(input.sandbox==='all'){clauses.shift();args.shift();}
  else args[0]=input.sandbox===true||input.sandbox==='1'?1:0;
  if(input.orderType==='cash'){clauses.push('currency<>?');args.push('PTS');}
  if(input.orderType==='points'&&input.pointsOnly!==true){clauses.push('currency=?');args.push('PTS');}
  if(input.channel&&input.channel!=='all'){
    if(!['mini','website','unknown'].includes(input.channel))throw Error('渠道无效');
    clauses.push("(CASE WHEN json_extract(data,'$.sourceEnd')='mini' THEN 'mini' WHEN json_extract(data,'$.sourceEnd') IN ('web','pc','h5','website') THEN 'website' ELSE 'unknown' END)=?");args.push(input.channel);
  }
  if (input.pointsOnly === true) {
    clauses.push('currency=?');
    args.push('PTS');
  }
  if (input.status) {
    clauses.push('status=?');
    args.push(String(input.status).slice(0, 40));
  }
  if (input.q) {
    clauses.push(
      '(order_number LIKE ? OR id LIKE ? OR data LIKE ? OR id IN (SELECT order_id FROM order_items WHERE snapshot LIKE ?))',
    );
    args.push(...Array(4).fill('%' + String(input.q).slice(0, 100) + '%'));
  }
  if (input.from && input.to && Date.parse(input.from) >= Date.parse(input.to))
    throw Error('结束日期必须晚于开始日期');
  for (const [key, op] of [
    ['from', '>='],
    ['to', '<'],
  ])
    if (input[key]) {
      const date = new Date(input[key]);
      if (!Number.isFinite(date.getTime())) throw Error('日期无效');
      clauses.push((input.dateBasis==='paid'?"(SELECT MIN(h.created_at) FROM order_history h WHERE h.order_id=orders.id AND h.action='approve')":'created_at') + op + '?');
      args.push(date.toISOString());
    }
  if (Object.hasOwn(input, 'selected')) {
    const ids = selectedIds(input.selected);
    clauses.push('id IN (' + ids.map(() => '?').join(',') + ')');
    args.push(...ids);
  }
  return { sql: clauses.join(' AND '), args };
}
export async function runBatch(ids, operation) {
  const results = [];
  for (const id of selectedIds(ids)) {
    try {
      await operation(id);
      results.push({ id, ok: true });
    } catch (error) {
      results.push({
        id,
        ok: false,
        error:
          error instanceof Error &&
          !/SQL|constraint|database/i.test(error.message)
            ? error.message
            : '操作失败，请刷新后重试',
      });
    }
  }
  return results;
}
export function pointBatchPermission(operation) {
  if (operation === 'ship') return 'fulfill';
  if (operation === 'close') return 'aftersale';
  throw Error('批量操作无效');
}
export function pendingPointRefund(order) {
  return (
    order.currency === 'PTS' &&
    order.status === 'closed' &&
    order.data?.redemptionState === 'pending'
  );
}
