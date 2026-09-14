export function assertRedemptionPublish(product) {
 if(product.status!=='published') throw Error('请先在商品管理中发布该普通商品');
 const t=product.trade;
 if(!t?.redemptionQuota || t.redemptionQuota<1) throw Error('请设置大于0的兑换总数量');
 if(!Number.isSafeInteger(t.inventory)||t.inventory<1) throw Error('商品库存不足，请先设置可用库存');
 if(!t.variants?.some(v=>v.enabled&&Number.isSafeInteger(v.pointsPrice)&&v.pointsPrice>0)) throw Error('至少为一个可用规格设置兑换积分');
}
