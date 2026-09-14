import assert from 'node:assert/strict';
const base='http://localhost:3001',jar=new Map();let checks=0;
const remember=r=>{for(const c of r.headers.getSetCookie()){const pair=c.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}};
async function request(path,data){const r=await fetch(base+path,{method:data?'POST':'GET',headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(data?{Origin:base,'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});remember(r);return r;}
async function json(path,data){const r=await request(path,data),d=await r.json();assert.ok(r.ok,JSON.stringify(d));return d}
const check=(value,label)=>{assert.ok(value,label);checks++};
remember(await fetch(base+'/signin-with-chatgpt?return_to=%2F',{redirect:'manual'}));
const now=Date.now(),at=n=>new Date(now+n*60000).toISOString();
const event=(await json('/api/marketing/admin-save',{titleZh:'沙龙联调测试 '+new Date().toISOString(),titleEn:'Salon integration test',status:'published',test:true,allowCancel:true,capacity:1,timezone:'Asia/Shanghai',starts:at(60),ends:at(180),registrationStarts:at(-60),registrationEnds:at(30),checkinStarts:at(-10),checkinEnds:at(120),cancelEnds:at(20),fields:[]})).event;
check(!!event.id,'event saved');
const qr=await json('/api/marketing/admin-qr?id='+event.id);check(Buffer.from(qr.png,'base64').subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'real PNG');check(qr.url.includes(event.id)&&qr.url.includes('checkin='),'event URL encoded');
const pub=(await json('/api/marketing/detail?id='+event.id)).event;check(!pub.checkinCode,'public projection');
const config=await json('/api/social/status'),provider=config.providers.find(p=>p.enabled)?.provider;assert.ok(provider,'Need an existing enabled sandbox provider');
const snap=await json('/api/admin');const policies=Object.fromEntries(snap.policies.filter(p=>['terms','privacy'].includes(p.kind)).map(p=>[p.kind,p.version]));
const start=await json('/api/social/start',{provider});await json('/api/social/finish',{...policies,ticket:start.ticket,firstName:'Salon',lastName:'Sandbox',consent:true});
check((await request('/api/marketing/checkin',{id:event.id,code:event.checkinCode})).status===400,'unregistered blocked');
const r=(await json('/api/marketing/register',{id:event.id,answers:{},consent:true})).registration;
check((await json('/api/marketing/register',{id:event.id,answers:{},consent:true})).registration.id===r.id,'duplicate idempotent');
const c=(await json('/api/marketing/checkin',{id:event.id,code:event.checkinCode})).registration;
check(!!c.checkedAt,'timestamp recorded');check(!('note' in c)&&!('checkinActor' in c),'private data redacted');
check((await json('/api/marketing/checkin',{id:event.id,code:event.checkinCode})).registration.checkedAt===c.checkedAt,'first timestamp retained');
check((await request('/api/marketing/cancel',{id:event.id})).status===400,'checked registration cannot cancel');
const stats=(await json('/api/marketing/admin-detail?id='+event.id)).stats;check(stats.valid===1&&stats.checked===1&&stats.remaining===0,'counts consistent');
check((await json('/api/marketing/admin-export',{id:event.id})).rows.length===1,'export correct');
await json('/api/marketing/admin-save',{...event,status:'archived',notify:false});
check((await request('/api/marketing/detail?id='+event.id)).status===400,'archived hidden');
console.log(checks+' marketing HTTP checks passed; clearly marked test activity archived, history retained.');
