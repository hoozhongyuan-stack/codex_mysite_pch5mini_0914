import Taro from '@tarojs/taro';
import {origin,request,token} from './api';
import {addLocalCart,consumeGuestSnapshot,cartLineKey} from './cart.mjs';
const key='mini-guest-cart:'+origin;
export const guestCart=():any[]=>Taro.getStorageSync(key)||[];
export const saveGuestCart=(rows:any[])=>Taro.setStorageSync(key,rows);
export const addGuestCart=(line:any)=>saveGuestCart(addLocalCart(guestCart(),line));
export async function mergeGuestCart(){
  if(!guestCart().length)return [];
  const captured=token();if(!captured)throw Error('请先登录');
  const session=await request('/api/mini/member/session',undefined,captured);
  const userId=String(session.user.id), pendingKey=key+':merge:'+userId;
  const rows=(await request('/api/mini/member/cart',undefined,captured)).rows;
  const failures:any[]=[];
  for(const line of guestCart()){
    if(token()!==captured)throw Error('登录状态已变化，未完成合并的商品已保留');
    try{
    const lineKey=line.productId+':'+line.variant;
    let pending=Taro.getStorageSync(pendingKey)||{};
    if(!pending[lineKey]){
      const old=rows.find((r:any)=>r.productId===line.productId&&r.variant===line.variant);
      pending={...pending,[lineKey]:{mergeId:Date.now()+'-'+Math.random().toString(36).slice(2),productId:line.productId,variant:line.variant,expectedQuantity:old?.quantity||0,guestQuantity:line.quantity,quantity:(old?.quantity||0)+line.quantity}};
      Taro.setStorageSync(pendingKey,pending);
    }
    await request('/api/mini/member/cart-merge',pending[lineKey],captured);
    const latest=(Taro.getStorageSync(pendingKey)||{})[lineKey];
    if(!latest||latest.mergeId!==pending[lineKey].mergeId)throw Error('购物车已更新，请重新核对后继续');
    const mergedQuantity=pending[lineKey].guestQuantity??(pending[lineKey].quantity-pending[lineKey].expectedQuantity);
    saveGuestCart(consumeGuestSnapshot(guestCart(),line,mergedQuantity));
    const remainder=guestCart().find(r=>cartLineKey(r)===cartLineKey(line));
    if(remainder)failures.push({...remainder,guest:true,reason:'新增数量尚未合并，请重试'});
    const next={...(Taro.getStorageSync(pendingKey)||{})};delete next[lineKey];Taro.setStorageSync(pendingKey,next);
    }catch(e){if(token()!==captured)throw e;failures.push({...line,guest:true,reason:'未合并：'+(e as Error).message});}
  }
  if(!Object.keys(Taro.getStorageSync(pendingKey)||{}).length)Taro.removeStorageSync(pendingKey);
  return failures;
}
export function dropGuestLine(line:any){
  saveGuestCart(guestCart().filter(r=>r.productId!==line.productId||r.variant!==line.variant));
  for(const storageKey of Taro.getStorageInfoSync().keys.filter(k=>k.startsWith(key+':merge:'))){
    const pending={...(Taro.getStorageSync(storageKey)||{})};
    delete pending[line.productId+':'+line.variant];Taro.setStorageSync(storageKey,pending);
  }
}
