import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutOwnerKey,submissionDefinitelyRejected} from '../lib/checkout-recovery.mjs';
test('checkout recovery survives session rotation while keeping accounts isolated',()=>{
 const stored=new Map(),origin='https://example.test';
 const before={userId:42,session:'old'},after={userId:42,session:'new'},other={userId:43,session:'another'};
 const pending={requestKey:'original-request',items:[{productId:'p',quantity:1}]};
 stored.set(checkoutOwnerKey(origin,before.userId),pending);
 assert.equal(stored.get(checkoutOwnerKey(origin,after.userId)),pending);
 assert.equal(stored.get(checkoutOwnerKey(origin,other.userId)),undefined);
 assert.throws(()=>checkoutOwnerKey(origin,null));
});
test('authentication interruption and uncertain transport failures preserve pending submission',()=>{
 for(const status of [undefined,0,401,403,404,408,429,500,502,503])assert.equal(submissionDefinitelyRejected(status),false);
 for(const status of [400,409,422])assert.equal(submissionDefinitelyRejected(status),true);
});
