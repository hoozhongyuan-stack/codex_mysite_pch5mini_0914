import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackCounter } from '../lib/behavior-client.mjs';
test('playback thresholds use actual continuous progress, never seek jumps',()=>{const p=playbackCounter();assert.deepEqual(p.tick(0,100,0,true),[]);assert.deepEqual(p.tick(90,100,1000,true),[]);for(let n=1;n<=10;n++){const events=p.tick(90+n,100,1000+n*1000,true);if(n===1)assert.deepEqual(events,['video_start']);if(n===10)assert.deepEqual(events,['video_valid']);}assert.equal(p.seconds(),10);});
test('playback completion requires actual 90 percent and thresholds emit once',()=>{const p=playbackCounter();p.tick(0,20,0,true);let events=[];for(let n=1;n<=20;n++)events.push(...p.tick(n,20,n*1000,true));assert.deepEqual(events,['video_start','video_valid','video_complete']);assert.deepEqual(p.tick(20,20,22000,false),[]);});
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
function browserSdk(choice){
 const values=new Map(Object.entries(choice)),requests=[];const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const context={exports:{},require:()=>({}),localStorage:storage,sessionStorage:storage,location:{pathname:'/zh/products/lamp',search:'?email=private@example.com'},crypto:{randomUUID},fetch:(url,options)=>{requests.push({url,...JSON.parse(options.body)});return Promise.resolve({ok:true})},Date,JSON};
 const source=fs.readFileSync(new URL('../app/behavior-client.tsx',import.meta.url),'utf8');
 context.require=(name)=>name==='@/lib/behavior-client.mjs'?{behaviorChoiceKey:'geo-behavior-choice-v1',playbackCounter}:{};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,context);
 return {...context,requests,values};
}
test('old AI consent never opts into behavior; explicit consent emits anonymous query-free events',()=>{
 const old=browserSdk({'geo-cookie-choice':'accepted'});old.exports.behavior('cart_add','lamp');assert.equal(old.requests.length,0);
 const yes=browserSdk({'geo-behavior-choice-v1':'accepted'});yes.exports.behavior('cart_add','lamp');assert.equal(yes.requests.length,1);const payload=yes.requests[0];assert.equal(payload.path,'/zh/products/lamp');assert.equal(payload.target,'lamp');assert.equal(payload.channel,'website');assert.ok(payload.visitorId);assert.ok(!JSON.stringify(payload).includes('private@example.com'));
 yes.values.set('geo-behavior-choice-v1','necessary');yes.exports.behavior('cart_add');assert.equal(yes.requests.length,1);
});
test('private order pages do not leak identifiers and repeated page effects deduplicate',()=>{
 const sdk=browserSdk({'geo-behavior-choice-v1':'accepted'});sdk.exports.observeBehavior();sdk.exports.observeBehavior();assert.equal(sdk.requests.length,1);
 sdk.location.pathname='/zh/orders/private-order-id';sdk.exports.behavior('page_view');assert.equal(sdk.requests.length,1);sdk.exports.behavior('order_submit');assert.equal(sdk.requests[1].path,'/zh/orders');
 sdk.localStorage.getItem=()=>{throw Error('disabled storage')};assert.doesNotThrow(()=>sdk.exports.behavior('favorite'));
});

test('replaying a short segment never completes a longer video',()=>{const p=playbackCounter();let time=0,events=[];p.tick(0,100,time,true);for(let round=0;round<12;round++){for(let n=1;n<=10;n++){time+=1000;events.push(...p.tick(n,100,time,true));}time+=1000;p.tick(0,100,time,true);}assert.equal(p.seconds(),120);assert.equal(p.coverage(),10);assert.ok(!events.includes('video_complete'));});
