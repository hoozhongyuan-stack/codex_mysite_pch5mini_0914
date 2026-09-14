import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryParentOptions, categoryTreeRows, categoryEditDraft } from '../lib/category-editor.mjs';
import { validateCategory } from '../lib/cms-domain.mjs';
const rows = [
 {id:'article-root',kind:'articles',parent_id:null,nameZh:'文章一级'},
 {id:'article-child',kind:'articles',parent_id:'article-root',nameZh:'文章二级'},
 {id:'product-root',kind:'products',parent_id:null,nameZh:'商品一级'},
 {id:'product-child',kind:'products',parent_id:'product-root',nameZh:'商品二级'},
];
test('article secondary creation retains selected parent and passes server rules',()=>{
 const opts=categoryParentOptions(rows,'articles');
 assert.deepEqual(opts,[['','无，作为一级分类'],['article-root','文章一级']]);
 const draft=categoryEditDraft({kind:'articles',parentId:'article-root',nameZh:'新二级',nameEn:'New child'});
 assert.equal(draft.parentId,'article-root');
 assert.equal(validateCategory(draft,rows).parentId,'article-root');
});
test('product tree displays same-kind secondary categories and respects collapse without mutation',()=>{
 const snapshot=JSON.stringify(rows);
 assert.deepEqual(categoryTreeRows(rows,'products').map(r=>r.id),['product-root','product-child']);
 assert.deepEqual(categoryTreeRows(rows,'products',['product-root']).map(r=>r.id),['product-root']);
 assert.equal(JSON.stringify(rows),snapshot);
});
test('parent selector excludes own identity, children and cross-kind parents; roots with children cannot become secondary',()=>{
 assert.deepEqual(categoryParentOptions(rows,'articles','article-root'),[['','无，作为一级分类']]);
 assert.deepEqual(categoryParentOptions(rows,'products','product-child'),[['','无，作为一级分类'],['product-root','商品一级']]);
});
test('editor supports camel-case drafts and database parent_id remains authoritative',()=>{
 assert.equal(categoryEditDraft(rows[3]).parentId,'product-root');
 assert.equal(categoryEditDraft({...rows[0],parentId:'stale'}).parentId,'');
 assert.deepEqual(categoryTreeRows([{id:'p',kind:'products'}, {id:'c',kind:'products',parentId:'p'}],'products').map(r=>r.id),['p','c']);
});
