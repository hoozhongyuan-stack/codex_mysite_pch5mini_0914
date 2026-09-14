import test from 'node:test';
import assert from 'node:assert/strict';
import {cartQuantity,addLocalCart,quoteStamp} from '../src/lib/cart.mjs';
test('cart quantities reject missing fractional negative and overflow values',()=>{
 for(const v of ['',0,-1,1.2,1000,'abc'])assert.throws(()=>cartQuantity(v));
 assert.equal(cartQuantity('2'),2);
});
test('local guest cart combines exact variants without mutating previous cart',()=>{
 const a=[{productId:'p',variant:'a',quantity:2}];
 assert.equal(addLocalCart(a,{productId:'p',variant:'a',quantity:3})[0].quantity,5);
 assert.equal(a[0].quantity,2);
 assert.equal(addLocalCart(a,{productId:'p',variant:'b',quantity:1}).length,2);
 assert.throws(()=>addLocalCart(a,{productId:'p',variant:'a',quantity:998}));
});
test('confirmation quote changes when shipping or unit price changes',()=>{
 const a={currency:'CNY',subtotal:100,shipping:0,total:100,items:[{productId:'p',variant:'a',quantity:1,unitPrice:100}]};
 assert.notEqual(quoteStamp(a),quoteStamp({...a,shipping:5,total:105}));
 assert.notEqual(quoteStamp(a),quoteStamp({...a,items:[{...a.items[0],unitPrice:101}]}));
});

test('switching a guest cart specification merges quantity without losing selection identity',async()=>{
 const {replaceLocalVariant,cartLineKey}=await import('../src/lib/cart.mjs');
 const rows=[{productId:'p',variant:'a',quantity:2},{productId:'p',variant:'b',quantity:3}];
 assert.deepEqual(replaceLocalVariant(rows,rows[0],{key:'b',label:'大号',priceMinor:200}).map(r=>r.quantity),[5]);
 assert.equal(rows[0].variant,'a');
 assert.equal(cartLineKey({...rows[0],guest:true}),'p:a');
});

test('successful merge consumes only the submitted guest snapshot, retaining newer additions',async()=>{
 const {consumeGuestSnapshot}=await import('../src/lib/cart.mjs');
 const rows=[{productId:'p',variant:'a',quantity:5}];
 assert.equal(consumeGuestSnapshot(rows,rows[0],2)[0].quantity,3);
 assert.equal(consumeGuestSnapshot(rows,rows[0],5).length,0);
 assert.equal(rows[0].quantity,5);
});
