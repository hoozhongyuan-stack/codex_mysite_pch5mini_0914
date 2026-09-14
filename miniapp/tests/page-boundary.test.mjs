import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('src');
test('registered pages are never imported as reusable components',()=>{
 const pages=['index','account','detail','checkout','form','login'].map(n=>path.join(root,'pages',n,'index.tsx'));
 function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
 for(const file of walk(root).filter(f=>/\.[jt]sx?$/.test(f))){
  const source=fs.readFileSync(file,'utf8');
  for(const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)){
   const target=path.resolve(path.dirname(file),match[1]);
   assert.ok(!pages.some(p=>p===target||p===target+'.tsx'||p===path.join(target,'index.tsx')),`${file} imports page ${match[1]}`);
  }
 }
});
