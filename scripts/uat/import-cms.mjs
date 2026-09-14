import {readFile,realpath,readdir,mkdtemp,mkdir,rename,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,sep,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createFilesystemBucket} from '../../lib/filesystem-storage.mjs';
const allowed=['contents','categories','assets','asset_folders','asset_folders_map','content_assets','navigation_items','policies','marketing_assets','settings'];
const emptyTables=[...allowed,'orders','order_items','order_files','order_history','order_addresses','order_counters','cart_items','submissions','submission_files','submission_history','submission_workflows','admin_memberships','audit_logs','evidence','rates','visits'];
const path=resolve(process.argv[2]||'');
if(!process.env.CMS_DATABASE_URL||!process.env.FILES_DIR)throw Error('CMS_DATABASE_URL and FILES_DIR required');
const data=JSON.parse(await readFile(path,'utf8'));
if(data.format!==1||!data.tables||!Array.isArray(data.assets)||Object.keys(data.tables).some(x=>!allowed.includes(x))||allowed.some(k=>!Array.isArray(data.tables[k])))throw Error('Invalid content-only export');
if(data.tables.settings.some(s=>!['site','commerce','channels'].includes(s.id)||(s.id==='commerce'&&'grants' in JSON.parse(s.data))))throw Error('Unapproved settings export');
const ids=data.tables.assets.map(a=>a.id),keys=data.assets.map(a=>a.key);
if(new Set(ids).size!==ids.length||new Set(keys).size!==keys.length||ids.length!==keys.length||ids.some(id=>!keys.includes(id)))throw Error('Asset manifest does not match asset records');
const root=resolve(process.env.FILES_DIR),exportRoot=await realpath(dirname(path));
async function requireEmptyFiles(){try{if((await readdir(root)).length)throw Error('Target asset directory is not empty');}catch(e){if(e.code!=='ENOENT')throw e;}}
await requireEmptyFiles();await mkdir(dirname(root),{recursive:true,mode:0o700});
const staging=await mkdtemp(join(dirname(root),'.uat-content-stage-')),files=createFilesystemBucket(staging);
const pool=new pg.Pool({connectionString:process.env.CMS_DATABASE_URL,max:1});
let client,promoted=false,commitStarted=false;
try{
 for(const asset of data.assets){
  const file=await realpath(resolve(dirname(path),asset.file));if(!file.startsWith(exportRoot+sep))throw Error('Invalid asset path');
  const bytes=await readFile(file);if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256||bytes.length!==asset.size||Number(data.tables.assets.find(a=>a.id===asset.key).size)!==asset.size)throw Error('Asset checksum or size mismatch');
  await files.put(asset.key,bytes,{httpMetadata:asset.httpMetadata});
 }
 client=await pool.connect();await client.query('BEGIN');
 await client.query(`LOCK TABLE ${emptyTables.join(',')} IN ACCESS EXCLUSIVE MODE`);
 for(const name of emptyTables){const r=await client.query(`SELECT COUNT(*) FROM ${name}`);if(Number(r.rows[0].count)!==0)throw Error('Target tables are not empty; refusing overwrite');}
 const categories=[...data.tables.categories],ordered=[];
 while(categories.length){const index=categories.findIndex(r=>!r.parent_id||ordered.some(x=>x.id===r.parent_id));if(index<0)throw Error('Category tree invalid');ordered.push(categories.splice(index,1)[0]);}
 for(const name of ['assets','asset_folders','categories','contents','asset_folders_map','content_assets','navigation_items','policies','settings','marketing_assets']){
  for(const row of name==='categories'?ordered:data.tables[name]){
   const columns=Object.keys(row);if(columns.some(k=>!/^\w+$/.test(k)))throw Error('Invalid field');
   await client.query(`INSERT INTO ${name} (${columns.map(k=>'"'+k+'"').join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));
  }
 }
 await requireEmptyFiles();await rename(staging,root);promoted=true;
 commitStarted=true;await client.query('COMMIT');console.log('Content and asset import committed');
}catch(e){
 if(client)await client.query('ROLLBACK').catch(()=>{});
 // A transport failure at COMMIT has an unknown outcome: preserve files for inspection.
 if(promoted&&commitStarted){const marker=join(dirname(root),`.uat-import-recovery-${randomUUID()}.json`);await writeFile(marker,JSON.stringify({files:root,export:path,reason:'Commit outcome requires database verification'}),{mode:0o600});}
 else if(promoted)await rm(root,{recursive:true,force:true});
 throw e;
}finally{if(!promoted)await rm(staging,{recursive:true,force:true});client?.release();await pool.end();}
