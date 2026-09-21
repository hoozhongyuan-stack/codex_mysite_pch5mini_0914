import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const schema = await readFile(new URL('../postgres/001-cms-schema.sql',import.meta.url),'utf8');
const guards = await readFile(new URL('../postgres/002-cms-guards.sql',import.meta.url),'utf8');
const imageVariants = await readFile(new URL('../postgres/004-image-variants.sql',import.meta.url),'utf8');
test('PostgreSQL baseline preserves all SQLite tables and all active trigger names', async () => {
 const tables=new Set(), triggers=new Set();
 for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()) {
  const source=await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8');
  for(const m of source.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? `([^`]+)`/g)) tables.add(m[1]);
  for(const m of source.matchAll(/(CREATE TRIGGER(?: IF NOT EXISTS)?|DROP TRIGGER) (\w+)/g)) m[1].startsWith('DROP')?triggers.delete(m[2]):triggers.add(m[2]);
 }
 assert.equal(tables.size,27); assert.equal(triggers.size,33);
 assert.deepEqual(new Set([...[...schema.matchAll(/CREATE TABLE "([^"]+)"/g)].map(m=>m[1]), ...[...imageVariants.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g)].map(m=>m[1])]),tables);
 assert.deepEqual(new Set([...guards.matchAll(/^CREATE TRIGGER (\w+)/gm)].map(m=>m[1])),triggers);
 assert.match(guards,/pg_advisory_xact_lock/); assert.match(guards,/FOR UPDATE/);
 assert.doesNotMatch(guards,/RAISE\(ABORT|json_extract|strftime/);
});

const url=process.env.PGSCHEMA_TEST_URL;
test('PostgreSQL real trigger integration: assets, categories, inventory, redemption and concurrent reservation', {skip: !url},async t => {
 const {Client}=await import('pg');
 const parsed=new URL(url); assert.match(parsed.pathname,/test|corpus/, 'Use a disposable test database');
 const namespace='cms_schema_'+randomUUID().replaceAll('-','');
 const db=new Client({connectionString:url}); await db.connect();
 await db.query(`CREATE SCHEMA ${namespace}`); await db.query(`SET search_path TO ${namespace},public`);
 await db.query(schema); await db.query(guards);
 t.after(async()=>{await db.query('ROLLBACK');await db.query(`DROP SCHEMA ${namespace} CASCADE`);await db.end();});
 const now='2026-09-13T12:00:00.000Z';
 const product=async(id,trade={},channels={website:true,mini:true})=>db.query('INSERT INTO contents(id,kind,slug,status,data,updated_at,created_at) VALUES($1,\'products\',$1,\'published\',$2,$3,$3)',[id,JSON.stringify({trade:{currency:'CNY',inventory:10,variants:[{key:'one',enabled:true,priceMinor:100,inventory:10,pointsPrice:5}],...trade},channels}),now]);
 const order=async(id,currency='CNY',data={},user='user')=>db.query('INSERT INTO orders(id,user_id,request_key,status,currency,subtotal,shipping,total,data,expires_at,created_at,updated_at) VALUES($1,$2,$1,\'building\',$3,100,0,100,$4,$5,$5,$5)',[id,user,currency,JSON.stringify(data),now]);
 const item=async(id,productId,qty=1,price=100,client=db)=>client.query('INSERT INTO order_items(id,order_id,product_id,variant,quantity,unit_price,snapshot) VALUES($1,$1,$2,\'one\',$3,$4,\'{}\')',[id,productId,qty,price]);
 const fails=async(sql,params,message)=>{
  await db.query('SAVEPOINT expected_failure');
  await assert.rejects(db.query(sql,params),message);
  await db.query('ROLLBACK TO SAVEPOINT expected_failure');
 };
 const caseTest=async(name,fn)=>t.test(name,async()=>{await db.query('BEGIN');try{await fn();}finally{await db.query('ROLLBACK');}});
 await caseTest('category hierarchy and deletion references',async()=>{
  await db.query("INSERT INTO categories VALUES ('parent','articles',NULL,'{}'),('child','articles','parent','{}')");
  await fails("INSERT INTO categories VALUES ('deep','articles','child','{}')",[],/hierarchy/);
  await fails("DELETE FROM categories WHERE id='parent'",[],/referenced/);
  await fails("UPDATE categories SET kind='products' WHERE id='child'",[],/hierarchy/);
 });
 await caseTest('asset references, footer/brand and folders',async()=>{
  await db.query('INSERT INTO assets VALUES($1,$1,\'image/png\',1,$2)',['asset',now]);
  await fails("INSERT INTO content_assets VALUES ('ref','article','absent')",[],/素材不存在/);
  await fails("INSERT INTO settings VALUES ('bad','{\"footer\":{\"logoId\":\"absent\"}}')",[],/页脚图片不存在/);
  await fails("INSERT INTO settings VALUES ('bad','{\"brand\":{\"logoId\":\"absent\"}}')",[],/品牌素材不存在/);
  await db.query("INSERT INTO settings VALUES ('good','{\"brand\":{\"logoId\":\"asset\"}}')");
  await fails("DELETE FROM assets WHERE id='asset'",[],/品牌与图标引用/);
  await fails("INSERT INTO asset_folders_map VALUES ('asset','absent')",[],/文件夹不存在/);
 });
 await caseTest('cash reservation, amount, pay/deduct/refund and immutable snapshot',async()=>{
  await product('product',{inventoryMode:'variants'});await order('order'); await item('order','product');
  await fails("UPDATE order_items SET quantity=2 WHERE id='order'",[],/不可修改/);
  await fails("DELETE FROM order_items WHERE id='order'",[],/不可删除/);
  await fails("UPDATE orders SET status='pending_payment',total=99 WHERE id='order'",[],/金额无效/);
  await fails("UPDATE contents SET data=jsonb_set(data::jsonb,'{trade,inventory}','0')::text WHERE id='product'",[],/库存不能低于/);
  await db.query("UPDATE orders SET status='pending_payment' WHERE id='order'");
  await fails("UPDATE orders SET status='completed' WHERE id='order'",[],/状态已变化/);
  await fails("UPDATE orders SET paid=1 WHERE id='order'",[],/收款状态无效/);
  await db.query("UPDATE orders SET status='pending_review' WHERE id='order'");
  await db.query("UPDATE orders SET status='pending_ship',paid=1 WHERE id='order'");
  let data=JSON.parse((await db.query("SELECT data FROM contents WHERE id='product'")).rows[0].data);
  assert.equal(data.trade.inventory,9);assert.equal(data.trade.variants[0].inventory,9);
  await fails("UPDATE contents SET data=jsonb_set(data::jsonb,'{trade,variants}','[]')::text WHERE id='product'",[],/已付款订单/);
  await db.query("UPDATE orders SET status='aftersale' WHERE id='order'");
  await db.query("UPDATE orders SET status='closed',refunded=1,restocked=1 WHERE id='order'");
  data=JSON.parse((await db.query("SELECT data FROM contents WHERE id='product'")).rows[0].data);
  assert.equal(data.trade.inventory,10);assert.equal(data.trade.variants[0].inventory,10);
  await fails("UPDATE orders SET restocked=0 WHERE id='order'",[],/不可重复返还/);
 });
 await caseTest('variant guard and stale stock revision',async()=>{
  await product('product',{inventoryMode:'variants',variants:[{key:'one',enabled:true,priceMinor:100,inventory:0}]});await order('order');
  await fails("INSERT INTO order_items VALUES ('order','order','product','one',1,100,'{}')",[],/规格库存不足/);
  await fails("UPDATE contents SET data=jsonb_set(data::jsonb,'{_expectedStockVersion}','\"stale\"')::text WHERE id='product'",[],/库存已更新/);
 });
 await caseTest('redemption quota/limit and channel restrictions',async()=>{
  await product('product',{redemptionEnabled:true,redemptionQuota:2,redemptionLimit:1});await order('order','PTS',{orderType:'points'});await item('order','product',1,5);
  await order('other','PTS',{orderType:'points'});
  await fails("INSERT INTO order_items VALUES ('other','other','product','one',1,5,'{}')",[],/价格或库存/);
  await product('web',{}, {website:true,mini:false});await order('mini','CNY',{sourceEnd:'mini'});
  await fails("INSERT INTO order_items VALUES ('mini','mini','web','one',1,100,'{}')",[],/展示渠道/);
 });
 await caseTest('active SKU cannot be removed or reduced below reserved quantity',async()=>{
  await product('product',{inventoryMode:'variants'});await order('order');await item('order','product',2);
  await fails("UPDATE contents SET data=jsonb_set(data::jsonb,'{trade,variants}','[]')::text WHERE id='product'",[],/规格库存不能低于/);
  await fails("UPDATE contents SET data=jsonb_set(data::jsonb,'{trade,variants,0,inventory}','1')::text WHERE id='product'",[],/规格库存不能低于/);
 });
 await caseTest('redemption global quota applies across different members',async()=>{
  await product('product',{redemptionEnabled:true,redemptionQuota:1,redemptionLimit:0});await order('first','PTS',{orderType:'points'},'a');await item('first','product',1,5);
  await order('second','PTS',{orderType:'points'},'b');
  await fails("INSERT INTO order_items VALUES ('second','second','product','one',1,5,'{}')",[],/价格或库存/);
 });
 await caseTest('order number UTC+8, monotonic sequence, immutable number',async()=>{
  await order('order','CNY',{address:{country:'China'}});
  const number=(await db.query("SELECT order_number FROM orders WHERE id='order'")).rows[0].order_number;
  assert.equal(number,'20260913200000-CN-000001');
  await fails("UPDATE orders SET order_number='changed' WHERE id='order'",[],/不可修改/);
  await order('second');
  assert.match((await db.query("SELECT order_number FROM orders WHERE id='second'")).rows[0].order_number,/-000002$/);
  await fails("INSERT INTO orders(id,user_id,request_key,status,currency,subtotal,shipping,total,data,sandbox,paid,refunded,restocked,expires_at,created_at,updated_at,order_number) SELECT 'invalid',user_id,'invalid',status,currency,subtotal,shipping,total,data,sandbox,paid,refunded,restocked,expires_at,'bad-time',updated_at,NULL FROM orders WHERE id='order'",[],/时间必须有效/);
 });
 await t.test('two simultaneous buyers cannot over-reserve final unit',async()=>{
  await product('scarce',{inventory:1}); await order('buyer-a'); await order('buyer-b');
  const client=new Client({connectionString:url});await client.connect();await client.query(`SET search_path TO ${namespace},public`);
  try{
   await db.query('BEGIN');await item('buyer-a','scarce');
   const attempt=item('buyer-b','scarce',1,100,client);
   const rejection=assert.rejects(attempt,/价格或库存/);
   await db.query('COMMIT');await rejection;
   assert.equal(Number((await db.query("SELECT SUM(quantity) AS qty FROM order_items WHERE product_id='scarce'")).rows[0].qty),1);
  }finally{await db.query('ROLLBACK');await client.end();}
 });
});
