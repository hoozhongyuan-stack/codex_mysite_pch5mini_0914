import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
test('late checkout address response cannot replace the new account addresses',async()=>{
 let current='a',show,stateIndex=0,resolveA;
 const state=new Map();
 const mock={
  token:()=>current,origin:'https://example.invalid',
  useState:initial=>{const i=stateIndex++;state.set(i,initial);return [initial,value=>state.set(i,value)];},
  useRef:value=>({current:value}),useEffect:()=>{},useLoad:()=>{},useDidHide:()=>{},useDidShow:fn=>{show=fn;},
  Taro:{getStorageSync:()=>null},
  request:async path=>{
   if(path.endsWith('/session'))return {user:{id:current}};
   if(path.endsWith('/addresses')){
    if(current==='a')return new Promise(resolve=>{resolveA=resolve;});
    return {rows:[{id:'b-address',name:'B',isDefault:true}]};
   }
   if(path.endsWith('/payments'))return {offline:true};
   throw Error('Unexpected request');
  },
 };
 globalThis.__checkoutSessionMock=mock;
 const source=(await fs.readFile(new URL('../src/pages/checkout/index.tsx',import.meta.url),'utf8')).replace(/^import[\s\S]*?;\n/gm,'');
 const prefix="const {token,origin,useState,useRef,useEffect,useLoad,useDidHide,useDidShow,Taro,request}=globalThis.__checkoutSessionMock;const React={createElement:()=>null};const View='view',Text='text',Button='button',ActionButton='button',ActionView='view',ActionInput='input',Picker='picker',Input='input',GlobalNavigation=()=>null,CartContent=()=>null;const checkoutOwnerKey=(origin,id)=>origin+id;";
 const js=ts.transpileModule(prefix+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 const {default:Checkout}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 Checkout();show();await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof resolveA,'function');
 current='b';show();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.get(3)[0].id,'b-address');
 resolveA({rows:[{id:'a-private-address',name:'A'}]});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(state.get(3)[0].id,'b-address');
 delete globalThis.__checkoutSessionMock;
});
