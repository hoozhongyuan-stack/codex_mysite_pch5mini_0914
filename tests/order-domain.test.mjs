import test from 'node:test';
import assert from 'node:assert/strict';
import { orderConfig,address,checkout,transition } from '../lib/order-domain.mjs';
const config={enabled:true,timeoutHours:24,afterSaleDays:7,shipping:{CNY:1000},methods:[{id:'bank',nameZh:'转账',nameEn:'Bank',instructionsZh:'说明',instructionsEn:'Instructions',enabled:true}]};
const product={id:'p1',status:'published',titleZh:'实物',titleEn:'Item',spu:'P1',trade:{currency:'CNY',inventory:10,specs:[],variants:[{key:'default',priceMinor:2500,enabled:true}]}};
test('checkout derives prices, merges duplicates, charges shipping once',()=>{
 const result=checkout([{productId:'p1',variant:'default',quantity:2},{productId:'p1',variant:'default',quantity:1}],[product],orderConfig(config));
 assert.equal(result.total,8500);assert.equal(result.items.length,1);assert.equal(result.items[0].quantity,3);
});
test('checkout rejects unavailable, unpriced and mixed currencies',()=>{
 assert.throws(()=>checkout([{productId:'p1',variant:'default',quantity:1}],[{...product,status:'draft'}],config));
 assert.throws(()=>checkout([{productId:'p1',variant:'default',quantity:1}],[{...product,trade:{...product.trade,variants:[{key:'default',priceMinor:null,enabled:true}]}}],config));
 assert.throws(()=>checkout([{productId:'p1',variant:'default',quantity:1},{productId:'p2',variant:'default',quantity:1}],[product,{...product,id:'p2',trade:{...product.trade,currency:'USD'}}],config));
});
test('explicit aftersale configuration and valid address required',()=>{
 assert.throws(()=>orderConfig({...config,afterSaleDays:null}));
 assert.throws(()=>address({name:'A'}));
 assert.equal(address({name:'张三',phone:'13800000000',country:'CN',city:'上海',street:'测试地址'}).city,'上海');
});
test('normal state path requires authorized actor and full settlement',()=>{
 let order={status:'pending_payment',total:8500};
 for(const [action,actor,next,data] of [['proof','user','pending_review',{}],['approve','finance','pending_ship',{amount:8500}],['ship','fulfill','pending_receive',{}],['receive','user','completed',{}]]){assert.equal(transition(order,action,actor,data),next);order={...order,status:next}}
 assert.throws(()=>transition({status:'pending_review',total:8500},'approve','finance',{amount:8000}));
 assert.throws(()=>transition({status:'pending_review',total:8500},'approve','user',{amount:8500}));
});
test('aftersale restores previous state, refund requires confirmed returned goods',()=>{
 assert.equal(transition({status:'pending_ship'},'aftersale','user',{}),'aftersale');
 assert.equal(transition({status:'aftersale',priorStatus:'pending_receive'},'reject_aftersale','aftersale',{reason:'原因'}),'pending_receive');
 assert.throws(()=>transition({status:'aftersale',priorStatus:'pending_receive',total:100},'refund','aftersale',{amount:100}));
 assert.equal(transition({status:'aftersale',priorStatus:'pending_receive',total:100},'refund','aftersale',{amount:100,returned:true}),'closed');
});
test('checkout snapshots product reward points per unit',()=>{
 const rewarded={...product,trade:{...product.trade,rewardPoints:12}};
 const result=checkout([{productId:'p1',variant:'default',quantity:2}],[rewarded],config);
 assert.equal(result.items[0].rewardPoints,12);
 assert.throws(()=>checkout([{productId:'p1',variant:'default',quantity:1}],[{...product,trade:{...product.trade,rewardPoints:-1}}],config));
});
