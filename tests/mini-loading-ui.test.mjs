import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
async function component(path,dependencies){
 const code=ts.transpileModule(await fs.readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(key=>key==='react/jsx-runtime'?jsx:dependencies[key]||{},exports);return exports.default;
}
const native={View:'div',Text:'span',Image:'img',Input:'input',ScrollView:'div',Button:'button'};
const Loading=await component('miniapp/src/components/loading-state.tsx',{'@tarojs/components':native});
test('refresh status reserves a small message instead of replacing content with a skeleton',()=>{
 const html=renderToStaticMarkup(React.createElement(Loading,{refresh:true}));
 assert.match(html,/保留上次内容/);assert.doesNotMatch(html,/loading-block/);
});
test('first detail request reserves media and text space',()=>{
 const html=renderToStaticMarkup(React.createElement(Loading,{detail:true}));
 assert.match(html,/loading-detail/);assert.match(html,/loading-block/);assert.match(html,/loading-line/);
});
test('catalog keeps existing cards during a refresh',async()=>{
 const values=['','','','',1,'latest',false,{rows:[{id:'one',kind:'articles',title:'仍可见的文章',summary:'内容'}],categories:[],pages:1,total:1},'',true,0,null];let index=0;
 const Catalog=await component('miniapp/src/components/catalog.tsx',{'react':{...React,useState:()=>[values[index++],()=>{}],useEffect:()=>{},useRef:()=>({current:0})},'@tarojs/components':native,'./interaction':{ActionView:'div',ActionText:'span',ActionButton:'button',ActionInput:'input'},'./loading-state':{default:Loading},'../lib/api':{image:()=>''}});
 const html=renderToStaticMarkup(React.createElement(Catalog,{kind:'articles'}));
 assert.match(html,/仍可见的文章/);assert.match(html,/保留上次内容/);assert.match(html,/content-updating/);
});
