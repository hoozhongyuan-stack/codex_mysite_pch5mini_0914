import { modules } from './list-domain.mjs';
export const activityModules = { accounts:'账号', permissions:'授权', orders:'订单', marketing:'营销', content:'内容', categories:'分类', assets:'素材', navigation:'导航', policies:'政策', settings:'设置', submissions:'表单提交', geo:'GEO', users:'访客', other:'其他' };
export function activityModule(action) {
  if(action.startsWith('permission-') || /^(group-|member-|legacy-)/.test(action)) return 'permissions';
  if(/^(staff-|account-)/.test(action) || action==='saveAdmin') return 'accounts';
  if(action.startsWith('order-')) return 'orders';
  if(/^(marketing-|salon-)/.test(action)) return 'marketing';
  if(/^(user-|visitor-)/.test(action)) return 'users';
  return Object.entries(modules).find(([,items])=>items.includes(action))?.[0] || 'other';
}
export function activityQuery(input) {
  const q={actor:String(input.actor||'').trim(),action:String(input.action||'').trim(),module:String(input.module||''),from:String(input.from||''),to:String(input.to||''),page:Number(input.page||1),size:30};
  if(q.actor.length>254 || q.action.length>80 || (q.module && !Object.hasOwn(activityModules,q.module)) || !Number.isInteger(q.page)||q.page<1||q.page>150) throw Error('日志筛选无效');
  for(const key of ['from','to']) if(q[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(q[key]) || !Number.isFinite(Date.parse(q[key])) || new Date(q[key]).toISOString().slice(0,10)!==q[key])) throw Error('日志日期无效');
  if(q.from && q.to && q.from>q.to) throw Error('开始日期不能晚于结束日期');
  return q;
}
