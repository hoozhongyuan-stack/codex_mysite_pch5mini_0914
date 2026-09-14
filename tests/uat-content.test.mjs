import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const fixtures=`import sqlite3,json,sys,pathlib
p=pathlib.Path(sys.argv[1]);db=sqlite3.connect(p/'cms.sqlite')
for t in ['asset_folders','asset_folders_map','content_assets','navigation_items','policies','marketing_assets']:db.execute('CREATE TABLE '+t+'(id TEXT)')
db.executescript('CREATE TABLE categories(id TEXT,kind TEXT,parent_id TEXT,data TEXT); CREATE TABLE assets(id TEXT,name TEXT,mime TEXT,size INTEGER,created_at TEXT); CREATE TABLE contents(id TEXT,kind TEXT,slug TEXT,status TEXT,data TEXT,updated_at TEXT,created_at TEXT); CREATE TABLE settings(id TEXT,data TEXT); CREATE TABLE orders(id TEXT,data TEXT); CREATE TABLE submissions(id TEXT,data TEXT);')
db.execute('INSERT INTO assets VALUES(?,?,?,?,?)',('image','image.png','image/png',7,'2026-01-01T00:00:00Z'))
db.execute('INSERT INTO contents VALUES(?,?,?,?,?,?,?)',('article','articles','sample','published',json.dumps({'titleZh':'中文文章','imageId':'image'}),'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z'))
db.execute('INSERT INTO settings VALUES(?,?)',('commerce',json.dumps({'enabled':True,'grants':{'private-user':'owner'},'secret':'excluded'})))
db.execute('INSERT INTO settings VALUES(?,?)',('secret_config',json.dumps({'password':'must-not-export'})))
db.execute('INSERT INTO orders VALUES(?,?)',('private-order','private-data'));db.execute('INSERT INTO submissions VALUES(?,?)',('private-form','private-data'));db.commit();db.close()
r=sqlite3.connect(p/'r2.sqlite');r.execute('CREATE TABLE _mf_objects(key TEXT,blob_id TEXT,size INTEGER,http_metadata TEXT)');r.execute('INSERT INTO _mf_objects VALUES(?,?,?,?)',('image','payload',7,json.dumps({'contentType':'image/png'})));r.commit();r.close()
(p/'blobs').mkdir();(p/'blobs'/'payload').write_bytes(b'PNGDATA')
`;
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'uat-content-test-'));await exec('python3',['-c',fixtures,dir]);return dir;}
async function exportContent(dir){await exec('python3',['scripts/uat/export-cms.py','--source',join(dir,'cms.sqlite'),'--r2',join(dir,'r2.sqlite'),'--blobs',join(dir,'blobs'),'--output',join(dir,'export')]);return JSON.parse(await readFile(join(dir,'export/cms.json'),'utf8'));}
test('content export excludes private records and unapproved settings/grants',async()=>{
 const dir=await fixture();try{const data=await exportContent(dir);const serialized=JSON.stringify(data);assert.ok(!serialized.includes('private-data'));assert.ok(!serialized.includes('must-not-export'));assert.ok(!serialized.includes('private-user'));assert.ok(!serialized.includes('grants'));assert.equal(data.assets.length,1);assert.equal(JSON.parse(data.tables.contents[0].data).titleZh,'中文文章');await assert.rejects(exportContent(dir));}finally{await rm(dir,{recursive:true,force:true});}
});
const url=process.env.POSTGRES_ADAPTER_TEST_URL;
test('content import preserves asset integrity, rolls back invalid data and refuses occupied target',{skip:!url},async()=>{
 const {Client}=await import('pg');const client=new Client({connectionString:url});await client.connect();const dir=await fixture(),ns='uat_content_'+Date.now();
 try{
  const data=await exportContent(dir);await client.query(`CREATE SCHEMA ${ns}; SET search_path TO ${ns},public`);await client.query(await readFile('postgres/001-cms-schema.sql','utf8'));await client.query(await readFile('postgres/002-cms-guards.sql','utf8'));
  const uri=new URL(url);uri.searchParams.set('options',`-c search_path=${ns},public`);const env={...process.env,CMS_DATABASE_URL:uri.href,FILES_DIR:join(dir,'files')};
  const run=()=>exec(process.execPath,['scripts/uat/import-cms.mjs',join(dir,'export/cms.json')],{env});
  const corrupt=structuredClone(data);corrupt.assets[0].sha256='0'.repeat(64);await writeFile(join(dir,'export/cms.json'),JSON.stringify(corrupt));await assert.rejects(run());assert.equal((await client.query('SELECT count(*) FROM assets')).rows[0].count,'0');
  // Constraint failure must leave neither inserted DB rows nor filesystem payloads.
  const bad=structuredClone(data);bad.tables.contents.push({...bad.tables.contents[0]});await writeFile(join(dir,'export/cms.json'),JSON.stringify(bad));await assert.rejects(run());assert.equal((await client.query('SELECT count(*) FROM assets')).rows[0].count,'0');await assert.rejects(readdir(env.FILES_DIR));
  await writeFile(join(dir,'export/cms.json'),JSON.stringify(data));await run();assert.equal((await client.query('SELECT count(*) FROM contents')).rows[0].count,'1');assert.equal((await readdir(env.FILES_DIR)).length,1);assert.equal((await client.query('SELECT count(*) FROM orders')).rows[0].count,'0');await assert.rejects(run());
 }finally{await client.query(`SET search_path TO public; DROP SCHEMA ${ns} CASCADE`);await client.end();await rm(dir,{recursive:true,force:true});}
});
