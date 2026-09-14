import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const nativePages=new Set(['app/manage/form-workspace-tabs.tsx','app/login/login-view.tsx','app/social-login.tsx','app/admin/login/staff-login.tsx']);
async function files(dir){return (await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
test('new page anchors must use the shared navigation boundary',async()=>{
 const violations=[];
 for(const file of (await files('app')).filter(p=>p.endsWith('.tsx')&&!nativePages.has(p))){
  const text=await fs.readFile(file,'utf8');const source=ts.createSourceFile(file,text,99,true,ts.ScriptKind.TSX);
  function visit(node){if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(source)==='a')violations.push(file);ts.forEachChild(node,visit)}visit(source);
 }
 assert.deepEqual(violations,[]);
});
test('global feedback includes native and ARIA controls and honors reduced motion',async()=>{
 const css=await fs.readFile('app/interaction.css','utf8');
 for(const marker of ['button,a[href],summary','[role="tab"]','input,select,textarea',':focus-visible',':active',':disabled','aria-busy','prefers-reduced-motion'])assert.ok(css.includes(marker),marker);
 const layout=await fs.readFile('app/layout.tsx','utf8');assert.ok(layout.includes("import './interaction.css'"));
});
