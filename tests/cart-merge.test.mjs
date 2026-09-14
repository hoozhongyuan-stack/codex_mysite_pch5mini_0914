import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mergeCartSql} from '../lib/cart-domain.mjs';
import {quoteStamp} from '../lib/checkout-confirmation.mjs';
test('guest merge retry is idempotent and never overwrites a concurrent cart edit',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE cart_items(id TEXT,user_id TEXT,product_id TEXT,variant TEXT,quantity INTEGER,updated_at TEXT,UNIQUE(user_id,product_id,variant))');
 const merge=(user,expected,quantity)=>db.prepare(mergeCartSql).run('i',user,'p','v',quantity,'now',expected,user,'p','v',expected).changes;
 assert.equal(merge('u',0,2),1);
 assert.equal(merge('u',0,2),1);
 assert.equal(db.prepare('SELECT quantity FROM cart_items WHERE user_id=?').get('u').quantity,2);
 db.exec("UPDATE cart_items SET quantity=4 WHERE user_id='u'");
 assert.equal(merge('u',2,3),0);
 assert.equal(db.prepare('SELECT quantity FROM cart_items WHERE user_id=?').get('u').quantity,4);
 assert.equal(merge('other',0,1),1);
 assert.equal(merge('missing',2,3),0);
 db.close();
});
test('server confirmation covers quantities currency prices and shipping',()=>{
 const q={currency:'CNY',subtotal:100,shipping:10,total:110,items:[{productId:'p',variant:'v',quantity:1,unitPrice:100}]};
 for(const changed of [{...q,currency:'USD'},{...q,shipping:11,total:111},{...q,items:[{...q.items[0],unitPrice:101}]},{...q,items:[{...q.items[0],quantity:2}]}])assert.notEqual(quoteStamp(q),quoteStamp(changed));
});

test('cart specification replacement is owner scoped and preserves both rows on collision',async()=>{
 const {replaceCartVariantSql}=await import('../lib/cart-domain.mjs');
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE cart_items(id TEXT,user_id TEXT,product_id TEXT,variant TEXT,quantity INTEGER,updated_at TEXT,UNIQUE(user_id,product_id,variant));INSERT INTO cart_items VALUES('a','u','p','small',2,'now'),('b','u','p','large',3,'now')");
 const change=(user,target)=>db.prepare(replaceCartVariantSql).run(target,'later','a',user,'p',user,'p',target,'a').changes;
 assert.equal(change('other','medium'),0);
 assert.equal(change('u','large'),0);
 assert.equal(db.prepare('SELECT quantity FROM cart_items WHERE id=?').get('a').quantity,2);
 assert.equal(change('u','medium'),1);
 assert.equal(change('u','medium'),1);
 assert.equal(db.prepare('SELECT variant FROM cart_items WHERE id=?').get('a').variant,'medium');
 db.close();
});
