// Local synthetic fixture only; credentials are read from a mode-0600 temporary file.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile('/tmp/points-fixture.json','utf8'));
const base='http://localhost:3001',cookie=`geo_staff=${fixture.staff}; geo_visitor=${fixture.visitor}`;
let checks=0;
async function req(path,data){return fetch(base+path,{method:data?'POST':'GET',headers:{cookie,Origin:base,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});}
async function api(path,data){const r=await req(path,data),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d;}
const check=(v,label)=>{assert.ok(v,label);checks++;};
const previous=await api('/api/orders/admin-settings');let productId;
const tag='points-phase2-'+Date.now(),address={name:'积分验收',phone:'13800000000',country:'CN',city:'上海',street:'本地模拟地址'};
try {
 const snapshot=await api('/api/admin');const imageId=snapshot.assets?.find(x=>x.mime?.startsWith('image/')||x.kind==='image')?.id || '';
 const existing=JSON.parse(await readFile('/tmp/points-product.json','utf8').catch(()=>'{"productId":null}'));
 productId=existing.productId || (await api('/api/admin',{action:'saveContent',data:{kind:'products',status:'published',slug:tag,titleZh:'积分兑换测试商品',titleEn:'Points test reward',summaryZh:'本地测试',summaryEn:'Local test',bodyZh:'测试正文',bodyEn:'Test details',imageId,spu:'POINTS-QA',trade:{currency:'CNY',inventory:5,inventoryDisplay:'quantity',specs:[],rewardPoints:30,redemptionEnabled:true,redemptionQuota:5,redemptionLimit:3,redemptionSort:0,variants:[{key:'default',priceMinor:1000,pointsPrice:100,enabled:true}]}}})).id;
 const existingRow=(await api('/api/admin/list?kind=products&q=POINTS-QA&size=100')).rows.find(x=>x.id===productId);
 if(existingRow.status!=='published')await api('/api/admin',{action:'saveContent',expectedUpdatedAt:existingRow.updatedAt,data:{...existingRow,status:'published'}});
 await api('/api/orders/admin-settings',{...previous,enabled:true,testProductIds:[...(previous.testProductIds||[]),productId]});
 await writeFile('/tmp/points-product.json',JSON.stringify({productId,tag,previous}),{mode:0o600});
 for(const o of (await api('/api/orders/list')).rows)if(o.currency==='PTS' && o.status==='pending_ship')await api('/api/mall/cancel',{id:o.id});
 const balance=async()=>(await api('/api/points/summary')).balance;
 const start=await balance();
 const payload={productId,variant:'default',quantity:1,address,requestKey:crypto.randomUUID()};
 const attempts=await Promise.all([req('/api/mall/create',payload),req('/api/mall/create',payload)]);
 const results=await Promise.all(attempts.map(async r=>({ok:r.ok,data:await r.json()})));
 if(results.some(r=>!r.ok))console.log(results.map(r=>r.ok?'ok':r.data));
 check(results.every(r=>r.ok),'duplicate concurrent requests return same redemption');
 const order=results[0].data;check(order.id===results[1].data.id,'same order id');
 check(order.currency==='PTS'&&order.total===100&&order.shipping===0&&order.status==='pending_ship','points-only confirmed order');
 check(await balance()===start-100,'debit exactly once');
 check((await req('/api/orders/proof',{id:order.id})).status===400,'offline payment forbidden');
 await api('/api/mall/cancel',{id:order.id});await api('/api/mall/cancel',{id:order.id});
 check(await balance()===start,'cancel refunds once');
 const second=await api('/api/mall/create',{...payload,requestKey:crypto.randomUUID()});
 await api('/api/orders/admin-ship',{id:second.id});await api('/api/orders/receive',{id:second.id});
 check(await balance()===start-100,'redemption completion gives no purchase reward');
 await api('/api/orders/aftersale',{id:second.id,reason:'本地积分退货验收'});
 await api('/api/orders/admin-refund',{id:second.id,amount:100,returned:true,refundedAt:new Date().toISOString()});
 check(await balance()===start,'post-shipment refund returns points without payment file');
 await api('/api/orders/admin-restock',{id:second.id,reason:'测试确认回库'});
 check((await api('/api/orders/admin-stats?sandbox=1')).rows.some(r=>r.currency==='PTS'),'separate points statistics');
 check((await req('/api/mall/create',{...payload,quantity:4,requestKey:crypto.randomUUID()})).status>=400,'user quota enforced');
 check((await api('/api/mall/list')).rows.some(r=>r.id===productId),'published reward listed');
 const cash=await api('/api/orders/create',{requestKey:crypto.randomUUID(),items:[{productId,variant:'default',quantity:2}],address,fromCart:false});
 const upload=async(purpose)=>{const body=new FormData();body.set('purpose',purpose);body.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB5sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');const r=await fetch(base+'/api/order-files/'+cash.id,{method:'POST',headers:{cookie,Origin:base},body});const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d.id;};
 const file=await upload('payment');
 await api('/api/orders/proof',{id:cash.id,methodId:previous.methods.find(x=>x.enabled).id,files:[file],payer:'测试',paidAt:new Date().toISOString()});
 await api('/api/orders/admin-approve',{id:cash.id,amount:cash.total,receivedAt:new Date().toISOString()});
 await api('/api/orders/admin-ship',{id:cash.id});
 check(await balance()===start,'purchase before completion gives no points');
 await api('/api/orders/receive',{id:cash.id});check(await balance()===start+60,'purchase completion awards product snapshot');
 await api('/api/orders/aftersale',{id:cash.id,reason:'整单退货积分验收'});
 const partialFile=await upload('refund');
 await api('/api/orders/admin-refund',{id:cash.id,items:[{id:cash.items[0].id,quantity:1}],amount:1000,returned:true,file:partialFile,refundedAt:new Date().toISOString()});
 check(await balance()===start+30,'partial refund reverses only one unit');
 check((await api('/api/orders/detail?id='+cash.id)).status==='completed','remaining order stays completed');
 await api('/api/orders/aftersale',{id:cash.id,reason:'剩余商品退款'});
 await api('/api/orders/admin-refund',{id:cash.id,amount:cash.total-1000,returned:true,file:await upload('refund'),refundedAt:new Date().toISOString()});
 check(await balance()===start,'cash refund reverses reward');
 await api('/api/orders/admin-restock',{id:cash.id,reason:'测试回库'});
 console.log(`${checks} points commerce integration checks passed`);
} finally {
 await api('/api/orders/admin-settings',previous);
 // Leave a published synthetic reward for browser QA; final cleanup will unpublish it.
}
