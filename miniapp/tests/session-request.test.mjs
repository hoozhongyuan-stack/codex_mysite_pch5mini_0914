import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
test('expected-session request never sends as another account or delivers a stale response',async()=>{
 let current='account-a',sent=0,finish;
 globalThis.__miniRequestTest={getStorageSync:()=>current,request:()=>{sent++;return new Promise(resolve=>{finish=resolve;});}};
 const source=(await fs.readFile(new URL('../src/lib/api.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
 const prelude="const Taro=globalThis.__miniRequestTest;const MINI_API_ORIGIN='https://example.invalid';const responseData=x=>x;";
 const compiled=ts.transpileModule(prelude+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const api=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
 await assert.rejects(api.request('/write',{},'account-b'),/登录状态已变化/);
 assert.equal(sent,0);
 const pending=api.request('/write',{},'account-a');current='account-b';finish({statusCode:200,data:{private:'a'}});
 await assert.rejects(pending,/登录状态已变化/);
 assert.equal(sent,1);
 delete globalThis.__miniRequestTest;
});
