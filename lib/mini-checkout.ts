import { mergeCartSql, replaceCartVariantSql } from './cart-domain.mjs';
import { database, HttpError } from './server';
import { commerceConfig, expireOrders } from './orders';
import { checkout, integer, text } from './order-domain.mjs';

export async function miniQuote(items:any[]) {
  const db=database();
  await expireOrders();
  if(!Array.isArray(items)||!items.length||items.length>30)throw Error('请选择1至30个商品规格');
  const products=await Promise.all([...new Set(items.map(i=>text(i.productId,80,true)))].map(async id=>{
    const row=await db.prepare("SELECT id,status,data FROM contents WHERE id=? AND kind='products' AND json_extract(data,'$.channels.mini')=1").bind(id).first<any>();
    return row?{...JSON.parse(row.data),id:row.id,status:row.status}:null;
  }));
  const c=await commerceConfig();
  const quote=checkout(items,products.filter(Boolean),{...c,enabled:c.paymentChannels?.offline===true});
  for(const p of products.filter(Boolean)){
    const locked=await db.prepare("SELECT COALESCE(SUM(i.quantity),0) AS total FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')").bind(p.id).first<any>();
    const quantity=quote.items.filter((i:any)=>i.productId===p.id).reduce((n:number,i:any)=>n+i.quantity,0);
    if(quantity>p.trade.inventory-locked.total)throw new HttpError(409,`${p.titleZh}库存不足，请调整数量`);
    if(p.trade.inventoryMode==='variants')for(const line of quote.items.filter((i:any)=>i.productId===p.id)){
      const held=await db.prepare("SELECT COALESCE(SUM(i.quantity),0) AS total FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND i.variant=? AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')").bind(p.id,line.variant).first<any>();
      const variant=p.trade.variants.find((v:any)=>v.key===line.variant);
      if(!Number.isSafeInteger(variant?.inventory)||line.quantity>variant.inventory-held.total)throw new HttpError(409,`${p.titleZh}所选规格库存不足，请调整数量`);
    }
  }
  return quote;
}
export async function miniCart(userId:string){
  const db=database();
  await expireOrders();
  const rows=(await db.prepare('SELECT i.*,c.data,c.status FROM cart_items i LEFT JOIN contents c ON c.id=i.product_id WHERE user_id=? ORDER BY i.updated_at DESC').bind(userId).all<any>()).results;
  return {rows:await Promise.all(rows.map(async r=>{
    const p=r.data?JSON.parse(r.data):{};
    const v=p.trade?.variants?.find((v:any)=>v.key===r.variant&&v.enabled===true);
    const held=await db.prepare("SELECT COALESCE(SUM(i.quantity),0) AS total FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')").bind(r.product_id).first<any>();
    const variantHeld=p.trade?.inventoryMode==='variants'?await db.prepare("SELECT COALESCE(SUM(i.quantity),0) AS total FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND i.variant=? AND o.paid=0 AND o.status IN ('building','pending_payment','pending_review')").bind(r.product_id,r.variant).first<any>():null;
    const available=p.trade?.inventoryMode==='variants'?(Number.isSafeInteger(v?.inventory)?Math.max(0,v.inventory-variantHeld.total):0):(Number.isSafeInteger(p.trade?.inventory)?Math.max(0,p.trade.inventory-held.total):0);
    const reason=r.status!=='published'||p.channels?.mini!==true?'商品未在小程序上架':!v||v.priceMinor==null?'规格不可购买':available<r.quantity?'库存不足':'';
    const variantLabel=(p.trade?.specs||[]).map((spec:any)=>{const value=spec.values.find((v:any)=>r.variant.split('~').includes(v.id));return value?spec.nameZh+'：'+value.nameZh:'';}).filter(Boolean).join(' / ')||'默认规格';
    return {variantLabel,id:r.id,productId:r.product_id,variant:r.variant,quantity:r.quantity,title:p.titleZh||'商品已失效',imageId:p.imageId||p.imageIds?.[0],currency:p.trade?.currency,priceMinor:v?.priceMinor,available,reason};
  }))};
}
export async function updateMiniCart(userId:string,action:string,input:any){
  const db=database();
  if(action==='cart-remove'){
    await db.prepare('DELETE FROM cart_items WHERE id=? AND user_id=?').bind(String(input.id),userId).run();return {ok:true};
  }
  const quantity=integer(input.quantity,1,999),pid=text(input.productId,80,true),variant=text(input.variant,200,true);
  const row=await db.prepare("SELECT data FROM contents WHERE id=? AND kind='products' AND status='published' AND json_extract(data,'$.channels.mini')=1").bind(pid).first<any>();
  const p=row?JSON.parse(row.data):null;
  if(!p?.trade?.variants?.some((v:any)=>v.key===variant&&v.enabled&&v.priceMinor!=null))throw Error('商品规格已失效或暂不可购买');
  if(action==='cart-variant'){
    const result=await db.prepare(replaceCartVariantSql).bind(variant,new Date().toISOString(),text(input.id,80,true),userId,pid,userId,pid,variant,input.id).run();
    if(!result.meta.changes)throw new HttpError(409,'购物车中已有此规格，请调整已有商品数量；当前商品未改变');
    return {ok:true};
  }
  if(action==='cart-merge'){
    const expected=integer(input.expectedQuantity,0,999);
    const result=await db.prepare(mergeCartSql).bind(crypto.randomUUID(),userId,pid,variant,quantity,new Date().toISOString(),expected,userId,pid,variant,expected).run();
    if(!result.meta.changes)throw Error('购物车已在其他设备更新，请重新核对后合并');
    return {ok:true};
  }
  const expression=action==='cart-add'?'cart_items.quantity+excluded.quantity':'excluded.quantity';
  const result=await db.prepare(`INSERT INTO cart_items VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,product_id,variant) DO UPDATE SET quantity=${expression},updated_at=excluded.updated_at WHERE ${expression}<=999`).bind(crypto.randomUUID(),userId,pid,variant,quantity,new Date().toISOString()).run();
  if(!result.meta.changes)throw Error('数量最多999件');
  return {ok:true};
}
