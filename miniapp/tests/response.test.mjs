import test from 'node:test';
import assert from 'node:assert/strict';
import { responseData, loginResult } from '../src/lib/response.mjs';
test('JSON response handles objects and text without silent login failure',()=>{
 assert.deepEqual(responseData('{"enabled":true}'),{enabled:true});
 assert.throws(()=>responseData('<html>gateway</html>'),/接口/);
 assert.throws(()=>responseData(null),/接口/);
 assert.throws(()=>loginResult({}),/登录/);
 assert.throws(()=>loginResult({session:undefined,user:{id:'1'}}),/登录/);
 assert.equal(loginResult({session:'a'.repeat(43),user:{id:'1'}}).user.id,'1');
});
