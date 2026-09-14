// Derive refund amounts and reward reversals from immutable order item snapshots.
export function refundQuote(order, selection) {
  const prior=order.data.refundedItems || {};
  const chosen=selection ?? order.items.map(i=>({id:i.id,quantity:i.quantity-(prior[i.id] || 0)})).filter(i=>i.quantity>0);
  if(!Array.isArray(chosen)||!chosen.length)throw Error('请选择退款商品数量');
  const seen=new Set(), totals={...prior};let amount=0,points=0;
  for(const row of chosen){
    const item=order.items.find(i=>i.id===row.id);
    if(!item||seen.has(row.id)||!Number.isSafeInteger(row.quantity)||row.quantity<1||row.quantity>item.quantity-(prior[item.id]||0))throw Error('退款商品或数量无效');
    seen.add(row.id);totals[row.id]=(prior[row.id]||0)+row.quantity;
    amount+=item.unit_price*row.quantity;points+=(item.snapshot.rewardPoints||0)*row.quantity;
  }
  const full=order.items.every(i=>totals[i.id]===i.quantity);
  // Fixed shipping is returned only when all items have been refunded.
  if(full)amount+=order.shipping;
  return {items:chosen,totals,amount,points,full};
}
