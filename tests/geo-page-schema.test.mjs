import test from 'node:test';
import assert from 'node:assert/strict';
import {contentSchema, pageMetadata, categoryDescription, collectionSchema} from '../lib/geo-page-schema.mjs';
test('article schema prefers visible rich text and true publication timestamp',()=>{
 const s=contentSchema({kind:'articles',titleZh:'标题',richZh:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'真实正文'},{type:'image',attrs:{src:'abc'}}]}]},bodyZh:'旧文本',publishedAt:'2026-09-14',createdAt:'2026-09-01',author:'Leo'},'zh','https://example.com/zh/articles/a',{nameZh:'品牌'});
 assert.equal(s.articleBody,'真实正文');assert.equal(s.datePublished,'2026-09-14');assert.equal(s.author['@type'],'Person');
});
test('product offers exclude disabled or unpriced variants and never invent stock',()=>{
 const s=contentSchema({kind:'products',titleZh:'商品',trade:{currency:'CNY',variants:[{enabled:true,priceMinor:0},{enabled:true,priceMinor:null},{enabled:false,priceMinor:9900}]}},'zh','https://example.com/p',{});
 assert.equal(s.offers.length,1);assert.equal(s.offers[0].price,0);assert.equal(s.offers[0].availability,undefined);assert.equal(s.review,undefined);
});
test('metadata produces localized canonical and both language counterparts',()=>{
 const m=pageMetadata('https://example.com/','en','videos/x','Title','Description');assert.equal(m.alternates.canonical,'https://example.com/en/videos/x');assert.equal(m.alternates.languages['zh-CN'],'https://example.com/zh/videos/x');assert.equal(m.openGraph.description,'Description');
});
test('category fallback and collection schema describe actual items only',()=>{
 assert.match(categoryDescription({nameZh:'纸品',kind:'products'},'zh'),/纸品/);
 const s=collectionSchema('https://example.com/x','列表','zh',[{name:'a',url:'https://example.com/a'}]);assert.equal(s.mainEntity.numberOfItems,1);assert.equal(s.mainEntity.itemListElement[0].position,1);
});
test('aggregate stock must not imply every hidden variant is in stock',()=>{
 const s=contentSchema({kind:'products',trade:{inventoryMode:'variants',stockStatus:'in',currency:'CNY',variants:[{enabled:true,priceMinor:100}]}},'zh','https://example.com/p',{});
 assert.equal(s.offers[0].availability,undefined);
});
