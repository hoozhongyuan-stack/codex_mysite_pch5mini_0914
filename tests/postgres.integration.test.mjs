import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresDatabase} from '../lib/postgres.mjs';
import {postgresCompatibilitySql} from '../lib/postgres-compat.mjs';
const url=process.env.POSTGRES_ADAPTER_TEST_URL;
test('PostgreSQL actual JSON/filter/CAS/rollback application query compatibility',{skip:!url},async()=>{
 const {Pool}=await import('pg');const pool=new Pool({connectionString:url,max:1});
 try {
  await pool.query(postgresCompatibilitySql);
  await pool.query('CREATE TEMP TABLE contents(id text PRIMARY KEY,data text,status text); CREATE TEMP TABLE marketing_assets(id text PRIMARY KEY,event_id text,asset_id text);');
  const db=createPostgresDatabase(pool);
  await db.prepare('INSERT INTO contents VALUES(?,?,?)').bind('a',JSON.stringify({titleZh:'hello',channels:{mini:true},footer:{socials:[{imageId:'im'}]},revision:'v1'}),'published').run();
  assert.equal((await db.prepare("SELECT id FROM contents WHERE json_extract(data,'$.channels.mini')=1 AND instr(json_extract(data,'$.titleZh'),?)>0").bind('ell').first()).id,'a');
  const updated=await db.prepare("UPDATE contents SET data=json_set(data,'$.revision',?,'$._points.status','done') WHERE id=? AND json_extract(data,'$.revision') IS ?").bind('v2','a','v1').run();assert.equal(updated.meta.changes,1);
  assert.equal(JSON.parse((await db.prepare('SELECT data FROM contents').first()).data)._points.status,'done');
  await db.prepare("UPDATE contents SET data=json_set(data,'$.pointsPending',json('false'))").run();
  assert.equal(JSON.parse((await db.prepare('SELECT data FROM contents').first()).data).pointsPending,false);
  assert.equal((await db.prepare("SELECT id FROM contents WHERE EXISTS(SELECT 1 FROM json_each(contents.data,'$.footer.socials') WHERE json_extract(value,'$.imageId')=?)").bind('im').first()).id,'a');
  assert.equal((await db.prepare("SELECT id FROM contents WHERE EXISTS(SELECT 1 FROM json_tree(contents.data) WHERE value=?)").bind('im').first()).id,'a');
  const object=await db.prepare("SELECT json_object('titleZh',json_extract(data,'$.titleZh')) AS data FROM contents").first();assert.equal(JSON.parse(object.data).titleZh,'hello');
  await db.prepare("UPDATE contents SET data=json_set(data,'$.footer',json_extract(?, '$.footer'))").bind(JSON.stringify({footer:{new:true}})).run();
  assert.deepEqual(JSON.parse((await db.prepare('SELECT data FROM contents').first()).data).footer,{new:true});
  await db.prepare("UPDATE contents SET data=json_patch(data,?)").bind('{"footer":{"new":null,"extra":1}}').run();
  assert.deepEqual(JSON.parse((await db.prepare('SELECT data FROM contents').first()).data).footer,{extra:1});
  await db.prepare('INSERT OR IGNORE INTO marketing_assets VALUES(?,?,?)').bind('m','e','i').run();
  assert.equal((await db.prepare('INSERT OR IGNORE INTO marketing_assets VALUES(?,?,?)').bind('m','e','i').run()).meta.changes,0);
  await assert.rejects(db.batch([db.prepare('DELETE FROM contents WHERE id=?').bind('a'),db.prepare('INSERT INTO marketing_assets VALUES(?,?,?)').bind('m','e','i')]));
  assert.equal((await db.prepare('SELECT count(*) AS total FROM contents').first()).total,1);
 } finally {await pool.end();}
});
