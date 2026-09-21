export const orderStates={pending_payment:'待付款',pending_review:'待审核',pending_ship:'待发货',pending_receive:'待收货',completed:'已完成',closed:'已关闭',aftersale:'售后中'};
export const orderLabel=s=>orderStates[s]||'处理中';
export const amountLabel=(v,c)=>c==='PTS'?`${v} 积分`:`${c==='CNY'?'¥':c+' '}${(v/100).toFixed(2)}`;
export function memberName(user){if(!user)return '欢迎来到个人中心';return user.nickname||user.name||user.firstName||user.first_name||'网站会员'}
export function hasMiniWechatBinding(user){return Array.isArray(user?.providers)&&user.providers.includes('wechat-mini')}
