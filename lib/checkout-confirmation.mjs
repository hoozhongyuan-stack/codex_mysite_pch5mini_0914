export function quoteStamp(quote) {
  return JSON.stringify({currency:quote.currency,subtotal:quote.subtotal,shipping:quote.shipping,total:quote.total,items:quote.items.map(i=>({productId:i.productId,variant:i.variant,quantity:i.quantity,unitPrice:i.unitPrice}))});
}
