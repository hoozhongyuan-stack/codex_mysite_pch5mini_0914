import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { workspaceViews } from '../lib/workspace-route.mjs';
import { adminSurfaces } from '../lib/admin-surface-manifest.mjs';

test('every admin view has one declared template and existing implementation files', () => {
  const views=adminSurfaces.flatMap(x=>x.views);
  assert.equal(new Set(views).size, views.length, 'duplicate view inventory');
  assert.deepEqual([...views].sort(), [...workspaceViews].sort());
  for(const item of adminSurfaces) {
    assert.ok(item.children.length > 0);
    for(const file of item.files) assert.ok(fs.existsSync(`app/manage/${file}.tsx`), file);
  }
});
test('admin dialogs cannot bypass the shared sizing and dismissal contract', () => {
  for(const file of fs.readdirSync('app/manage').filter(f=>f.endsWith('.tsx')&&f!=='admin-dialog.tsx')) {
    const content=fs.readFileSync(`app/manage/${file}`,'utf8');
    assert.ok(!content.includes("from '@/components/ui/dialog'"), `${file} bypasses AdminDialog`);
  }
});
test('business controls use semantic size variants instead of inline dimensions', () => {
  const failures=[];
  for(const file of fs.readdirSync('app/manage').filter(f=>f.endsWith('.tsx'))) {
    const src=ts.createSourceFile(file,fs.readFileSync(`app/manage/${file}`,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const visit=n=>{
      if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)) {
        if(['button','input','select','textarea','SelectTrigger','DialogContent'].includes(n.tagName.getText(src))) {
          const style=n.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(src)==='style');
          if(style&&/\b(?:width|minWidth|maxWidth|height|minHeight|maxHeight|padding|fontSize)\s*:/.test(style.getText(src))) failures.push(file+':'+style.getText(src));
        }
      }
      ts.forEachChild(n,visit);
    };visit(src);
  }
  assert.deepEqual(failures,[],'Move dimensions into the admin design system');
});
