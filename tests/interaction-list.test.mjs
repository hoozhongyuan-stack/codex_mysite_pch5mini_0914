import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
const code=ts.transpileModule(await fs.readFile('app/manage/paged-content.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
function render(rows,error=''){
 const exports={};const blank=()=>null;
 const list={query:'view=articles',loading:true,error,result:{rows},reload:async()=>{}};
 new Function('require','exports',code)(key=>key==='react'?React:key==='react/jsx-runtime'?jsx:key==='./list-ui'?{useList:()=>list,useSelection:()=>({selected:[],toggle(){}}),Filters:blank,Pager:blank,ListState:blank,SelectAll:blank}:key==='@/lib/product-options.mjs'?{priceLabel:()=>''}:{default:blank},exports);
 return renderToStaticMarkup(React.createElement(exports.default,{kind:'articles',data:{categories:[],user:{role:'owner'}},reload:async()=>{}}));
}
test('article refresh retains rows and disables interaction instead of flashing empty',()=>{
 const html=render([{id:'demo',titleZh:'保留已有文章',slug:'demo',status:'draft',updatedAt:'2026-09-14'}]);
 assert.match(html,/保留已有文章/);assert.match(html,/aria-busy="true"/);assert.match(html,/inert=""/);assert.doesNotMatch(html,/list-skeleton-line/);
});
test('initial article load reserves five skeleton rows',()=>{
 assert.equal((render([]).match(/list-skeleton-line/g)||[]).length,5);
});
