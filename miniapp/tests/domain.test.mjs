import test from 'node:test';import assert from 'node:assert/strict';
import {navigation,resolveTarget,assetUrl,visibleFloating} from '../src/lib/domain.mjs';
const items=[{target:'home',label:'首页',enabled:true},{target:'products',label:'商品',enabled:true}];
test('navigation follows targets, order, hide and count rules',()=>{assert.equal(navigation({enabled:true,items}).length,2);assert.equal(navigation({enabled:false,items}).length,0);assert.throws(()=>navigation({enabled:true,items:items.slice(0,1)}));assert.throws(()=>navigation({enabled:true,items:[...items,items[0]]}));assert.equal(resolveTarget('products',items.toReversed()),'products');assert.equal(resolveTarget('videos',items),'home')});
test('resource URLs stay on compiled API origin',()=>{assert.equal(assetUrl('https://example.com','abc-123'),'https://example.com/api/media/abc-123');assert.equal(assetUrl('https://example.com','//evil'), '');assert.equal(assetUrl('', 'abc'),'')});
test('floating filters logical pages, validates phone and limits count',()=>{const a={enabled:true,ends:['mini'],pages:['/products'],kind:'phone',phone:'110'};assert.equal(visibleFloating([a],'/products').length,1);assert.equal(visibleFloating([a],'/articles').length,0);assert.equal(visibleFloating([{...a,phone:'javascript:1'}],'/products').length,0)});
test('entry destinations route cart/media independently and preserve direct list targets',async()=>{
 const {destinationUrl}=await import('../src/lib/domain.mjs');
 assert.equal(destinationUrl({target:'cart'}),'/pages/cart/index');
 assert.equal(destinationUrl({target:'videos'}),'/pages/videos/index');
 assert.equal(destinationUrl({target:'event',contentId:'e-1'}),'/pages/salons/index?id=e-1');
 assert.throws(()=>destinationUrl({target:'video',contentId:'../bad'}));
 assert.equal(destinationUrl({target:'products'}),'/pages/index/index?target=products');
 assert.equal(destinationUrl({target:'microPage',contentId:'page-1'}),'/pages/custom/index?id=page-1');
});

test('navigation accepts micro page entries with content ids',()=>{const items=[{target:'home',label:'首页',enabled:true},{target:'microPage',contentId:'page-1',label:'专题',enabled:true}];assert.equal(navigation({enabled:true,items}).length,2);assert.throws(()=>navigation({enabled:true,items:[items[0],{...items[1],contentId:''}]}));});
