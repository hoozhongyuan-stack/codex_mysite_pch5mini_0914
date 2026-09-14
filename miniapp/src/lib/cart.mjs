export function cartQuantity(value) {
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1||n>999)throw Error('数量须为1至999的整数');
  return n;
}
export function addLocalCart(rows,line) {
  const quantity=cartQuantity(line.quantity),key=line.productId+':'+line.variant;
  const old=rows.find(r=>r.productId+':'+r.variant===key);
  if(!old&&rows.length>=30)throw Error('购物车最多保存30个规格');
  const next={...line,quantity:cartQuantity(quantity+(old?.quantity||0))};
  return old?rows.map(r=>r===old?next:r):[...rows,next];
}
export {quoteStamp} from '../../../lib/checkout-confirmation.mjs';

export const cartLineKey=(line)=>line.productId+':'+line.variant;
export function replaceLocalVariant(rows,line,variant){
  if(variant.key===line.variant)return rows;
  return addLocalCart(rows.filter(r=>cartLineKey(r)!==cartLineKey(line)),{...line,variant:variant.key,variantLabel:variant.label,priceMinor:variant.priceMinor});
}
export function consumeGuestSnapshot(rows,line,quantity){
  const submitted=cartQuantity(quantity);
  return rows.flatMap(r=>cartLineKey(r)!==cartLineKey(line)?[r]:r.quantity>submitted?[{...r,quantity:r.quantity-submitted}]:[]);
}
