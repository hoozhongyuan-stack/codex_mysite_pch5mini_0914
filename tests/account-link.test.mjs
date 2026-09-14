import test from 'node:test';
import assert from 'node:assert/strict';
import { accountLink } from '../lib/account-link.mjs';
test('reads verify/reset links on initial visit, reload or fragment change',()=>{
 const token='a'.repeat(43);
 for(const mode of ['verify','reset']){
  const hash='#'+mode+'='+token;
  assert.deepEqual(accountLink(hash),{mode,token});
  assert.deepEqual(accountLink(hash),{mode,token});
 }
});
test('rejects missing, ambiguous and malformed link tokens',()=>{
 for(const hash of ['', '#verify=', '#verify=short', '#verify='+ 'a'.repeat(43)+'&reset='+ 'b'.repeat(43),'#verify='+ 'a'.repeat(43)+'&verify='+ 'b'.repeat(43)])assert.equal(accountLink(hash),null);
});
