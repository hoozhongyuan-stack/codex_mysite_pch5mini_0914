import assert from 'node:assert/strict';
const base='http://localhost:3001';let checks=0;const jar=new Map();
const remember=(r,j=jar)=>{for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');j.set(p.slice(0,i),p.slice(i+1))}};
const hdr=j=>({cookie:[...j].map(([k,v])=>k+'='+v).join('; ')});
async function req(p,data,j=jar){const r=await fetch(base+p,{method:data?'POST':'GET',headers:{...hdr(j),...(data?{Origin:base,'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});remember(r,j);return r}
async function json(p,data,j=jar){const r=await req(p,data,j),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d}
const check=(v,l)=>{assert.ok(v,l);checks++};
remember(await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'}));
const previous=await json('/api/orders/admin-settings');let productId;
const created=[];const tag='order-test-'+Date.now();
const address={name:'测试收货人',phone:'13800000000',country:'CN',city:'上海',street:'沙箱验收地址'};
async function upload(orderId,purpose='payment'){
const body=new FormData();body.set('purpose',purpose);body.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB5sAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test.png');const r=await fetch(base+'/api/order-files/'+orderId,{method:'POST',headers:{...hdr(jar),Origin:base},body});const d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d.id}
try{
 productId=(await json('/api/admin',{action:'saveContent',data:{kind:'products',status:'published',slug:tag,titleZh:'订单沙箱商品',titleEn:'Order sandbox item',summaryZh:'仅测试',summaryEn:'Test only',bodyZh:'测试正文',bodyEn:'Test body',trade:{currency:'CNY',inventory:3,inventoryDisplay:'quantity',specs:[],variants:[{key:'default',priceMinor:1000,enabled:true}]}}})).id;
 await json('/api/orders/admin-settings',{...previous,enabled:true,timeoutHours:24,afterSaleDays:7,shipping:{...previous.shipping,CNY:500},testProductIds:[productId],methods:[{id:'test-bank',nameZh:'测试收款（请勿转账）',nameEn:'Test only - do not pay',instructionsZh:'模拟验收',instructionsEn:'Sandbox validation',enabled:true}]});
 const snap=await json('/api/admin'),policies=Object.fromEntries(snap.policies.filter(p=>['terms','privacy'].includes(p.kind)).map(p=>[p.kind,p.version]));
 const provider=(await json('/api/social/status')).providers.find(p=>p.enabled).provider;
 const start=await json('/api/social/start',{provider});await json('/api/social/finish',{...policies,ticket:start.ticket,firstName:'Orders',lastName:'Sandbox',consent:true});
 await json('/api/orders/cart-add',{productId,variant:'default',quantity:1});check((await json('/api/orders/cart')).rows.some(r=>r.productId===productId),'cart persistent');
 const ad=await json('/api/orders/address-save',address);check((await json('/api/orders/addresses')).rows.some(a=>a.id===ad.id),'address saved');
 const payload={requestKey:crypto.randomUUID(),items:[{productId,variant:'default',quantity:2}],address,fromCart:false};
 const order=await json('/api/orders/create',payload);created.push(order.id);check(/^TEST-\d{14}-CN-\d{6,}$/.test(order.order_number),'readable sandbox number');check((await json('/api/orders/admin-list?sandbox=1&q='+encodeURIComponent(order.order_number))).rows.some(r=>r.id===order.id),'readable number search');check(order.total===2500&&order.shipping===500,'trusted total and fixed shipping');check((await json('/api/orders/create',payload)).id===order.id,'idempotency');
 check((await req('/api/orders/create',{...payload,address:{...address,name:'different'}})).status===400,'same key different payload blocked');
 check((await req('/api/orders/detail?id='+order.id,undefined,new Map())).status===401,'anonymous order denied');
 await json('/api/orders/admin-note',{id:order.id,note:'internal only'});
 const file=await upload(order.id);check((await fetch(base+'/api/order-files/'+file)).status!==200,'anonymous proof denied');
 await json('/api/orders/proof',{id:order.id,methodId:'test-bank',files:[file],payer:'Sandbox',paidAt:new Date().toISOString()});
 check((await json('/api/orders/admin-detail?id='+order.id)).data.internalNote==='internal only','visitor transition preserves internal note');
 check(!('internalNote' in (await json('/api/orders/detail?id='+order.id)).data),'internal note redacted');
 check((await req('/api/orders/admin-approve',{id:order.id,amount:1,receivedAt:new Date().toISOString()})).status===400,'wrong amount refused');
 await json('/api/orders/admin-reject',{id:order.id,reason:'模拟补充凭证'});check((await json('/api/orders/detail?id='+order.id)).status==='pending_payment','rejection restores payment');
 await json('/api/orders/proof',{id:order.id,methodId:'test-bank',files:[file],payer:'Sandbox',paidAt:new Date().toISOString()});
 await json('/api/orders/admin-approve',{id:order.id,amount:2500,receivedAt:new Date().toISOString()});
 check((await req('/api/orders/admin-approve',{id:order.id,amount:2500,receivedAt:new Date().toISOString()})).status===400,'repeat approval refused');
 await json('/api/orders/admin-ship',{id:order.id});const shipped=await json('/api/orders/detail?id='+order.id);check(shipped.status==='pending_receive','blank logistics allowed');
 await json('/api/orders/admin-logistics',{id:order.id,number:'TEST-123'});check((await json('/api/orders/detail?id='+order.id)).data.logistics.shippedAt===shipped.data.logistics.shippedAt,'shipment time retained');
 await json('/api/orders/aftersale',{id:order.id,reason:'模拟撤销售后'});await json('/api/orders/withdraw',{id:order.id});check((await json('/api/orders/detail?id='+order.id)).status==='pending_receive','withdraw restores prior state');
 await json('/api/orders/receive',{id:order.id});check((await json('/api/orders/detail?id='+order.id)).status==='completed','received completes order');
 await json('/api/orders/aftersale',{id:order.id,reason:'沙箱退货测试'});const refundFile=await upload(order.id,'refund');
 check((await req('/api/orders/admin-refund',{id:order.id,amount:2500,file:refundFile,refundedAt:new Date().toISOString(),returned:false})).status===400,'return receipt required');
 await json('/api/orders/admin-refund',{id:order.id,amount:2500,file:refundFile,refundedAt:new Date().toISOString(),returned:true});
 await json('/api/orders/admin-restock',{id:order.id,reason:'测试商品核实可售'});check((await req('/api/orders/admin-restock',{id:order.id,reason:'重复'})).status===400,'stock returned once');
 // Two requests for the remaining three pieces: only one 2-piece order may succeed.
 const attempts=await Promise.all([1,2].map(()=>req('/api/orders/create',{...payload,requestKey:crypto.randomUUID()})));
 check(attempts.filter(r=>r.ok).length===1,'concurrent checkout prevents oversell');
 for(const r of attempts)if(r.ok){const d=await r.json();created.push(d.id);await json('/api/orders/cancel',{id:d.id})}
 const stats=(await json('/api/orders/admin-stats?sandbox=1')).rows.find(r=>r.currency==='CNY');check(stats.received>=2500&&stats.refunded>=2500,'sandbox receipt and refund stats');
 check((await json('/api/orders/admin-export',{sandbox:true})).rows.some(r=>r.id===order.id),'export includes order');
 await json('/api/orders/address-delete',{id:ad.id});
 console.log(checks+' local order integration checks passed. Sandbox order history retained.');
}finally{
 for(const id of created){try{const o=await json('/api/orders/admin-detail?id='+id);if(['pending_payment','pending_review'].includes(o.status))await json('/api/orders/admin-close',{id,reason:'测试结束'})}catch{}}
 await json('/api/orders/admin-settings',previous);
 if(productId){const product=(await json('/api/admin/list?kind=products&q='+encodeURIComponent(tag)+'&size=100')).rows?.find(p=>p.id===productId);if(product)await json('/api/admin',{action:'saveContent',expectedUpdatedAt:product.updatedAt,data:{...product,status:'draft'}}); }
}
