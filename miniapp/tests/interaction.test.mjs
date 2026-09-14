import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {interactionState} from '../src/lib/interaction.mjs';

function primitives(){
 let state=false;
 const native=Object.fromEntries(['View','Text','Image','Button','Input','Textarea'].map(k=>[k,k]));
 const react={useState:()=>[state,value=>{state=value}],createElement:(tag,props)=>({tag,props})};
 const source=fs.readFileSync('src/components/interaction.tsx','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};
 new Function('require','exports',code)(name=>name==='react'?react:name==='react/jsx-runtime'?{jsx:react.createElement}:name==='@tarojs/components'?native:{interactionState},exports);
 return {components:exports};
}
test('all interactive primitives gate disabled and pending clicks and retain styling',()=>{
 const {components}=primitives();
 for(const name of ['ActionView','ActionText','ActionImage','ActionButton']){
  let clicks=0;
  for(const state of [{disabled:true},{loading:true}]){
   const node=components[name]({...state,className:'existing',onClick:()=>clicks++});
   node.props.onClick?.();
   assert.equal(clicks,0,name);
   assert.match(node.props.className,/existing interaction-target interaction-disabled/);
  }
  const active=components[name]({onClick:()=>clicks++});active.props.onClick();assert.equal(clicks,1);
 }
});
test('text and image get real touch feedback and cancel clears it',()=>{
 for(const name of ['ActionText','ActionImage']){
  const {components}=primitives();
  components[name]({}).props.onTouchStart({});
  assert.match(components[name]({}).props.className,/interaction-pressed/);
  components[name]({}).props.onTouchCancel({});
  assert.doesNotMatch(components[name]({}).props.className,/interaction-pressed/);
 }
});
test('native button retains sharing and loading, views use native hover',()=>{
 const {components}=primitives();
 assert.equal(components.ActionButton({openType:'share'}).props.openType,'share');
 assert.equal(components.ActionButton({loading:true}).props.loading,true);
 assert.equal(components.ActionView({}).props.hoverClass,'interaction-pressed');
 assert.equal(components.ActionView({disabled:true}).props.hoverClass,'none');
});
test('every native click target uses common feedback, except modal boundaries',()=>{
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
 for(const file of walk('src').filter(f=>f.endsWith('.tsx')&&!f.endsWith('/interaction.tsx'))){
  const src=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node){
   if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
    const tag=node.tagName.getText(ast),attrs=node.attributes.properties;
    const click=attrs.find(a=>a.name?.getText(ast)==='onClick');
    if(['View','Text','Image','Button','Input','Textarea'].includes(tag)&&(click||['Button','Input','Textarea'].includes(tag))){
     const boundary=node.getText(ast).includes('float-modal-mask')||click?.getText(ast).includes('stopPropagation()');
     assert.ok(boundary,`${file}:${ast.getLineAndCharacterOfPosition(node.pos).line+1} ${tag} bypasses feedback`);
    }
   }ts.forEachChild(node,visit);
  }visit(ast);
 }
});

test('field focus feedback preserves the original blur handler',()=>{
 const {components}=primitives();let blurred=0;
 components.ActionInput({}).props.onFocus({});
 assert.match(components.ActionInput({}).props.className,/interaction-focused/);
 components.ActionInput({onBlur:()=>blurred++}).props.onBlur({});
 assert.equal(blurred,1);
 assert.doesNotMatch(components.ActionInput({}).props.className,/interaction-focused/);
});

test('scroll movement clears text and image press feedback and preserves the touch callback',()=>{
 for(const name of ['ActionText','ActionImage']){
  const {components}=primitives();let moved=0;const event={detail:{x:20}};
  components[name]({}).props.onTouchStart({});
  assert.match(components[name]({}).props.className,/interaction-pressed/);
  components[name]({onTouchMove:value=>{assert.equal(value,event);moved++}}).props.onTouchMove(event);
  assert.equal(moved,1);
  assert.doesNotMatch(components[name]({}).props.className,/interaction-pressed/);
 }
});
