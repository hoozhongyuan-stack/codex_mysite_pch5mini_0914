import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutOperation} from '../src/lib/checkout-operation.mjs';
test('checkout operation keeps original owner and cannot submit after account changes during confirmation',async()=>{
 let session='a',calls=0;
 const operation=checkoutOperation('a','draft-a',()=>session,async(path,data,captured)=>{assert.equal(captured,'a');calls++;return {};});
 await operation.request('/quote',{});
 session='b';
 assert.equal(operation.ownerKey,'draft-a');
 assert.throws(operation.assertCurrent,/登录状态已变化/);
 await assert.rejects(operation.request('/create',{address:'a-address'}),/登录状态已变化/);
 assert.equal(calls,1);
});
test('late create result is not delivered to a different owner',async()=>{
 let session='a',finish;
 const operation=checkoutOperation('a','draft-a',()=>session,()=>new Promise(resolve=>{finish=resolve;}));
 const pending=operation.request('/create',{});session='b';finish({id:'a-order'});
 await assert.rejects(pending,/登录状态已变化/);
});
