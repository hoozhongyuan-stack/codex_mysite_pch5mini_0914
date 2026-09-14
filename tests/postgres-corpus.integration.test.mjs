import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import {translateSql,createPostgresDatabase} from '../lib/postgres.mjs';
import {activityModule,activityModules} from '../lib/staff-activity.mjs';
import {modules} from '../lib/list-domain.mjs';
import {mergeCartSql,replaceCartVariantSql} from '../lib/cart-domain.mjs';
import {postgresCompatibilitySql} from '../lib/postgres-compat.mjs';
const url=process.env.POSTGRES_ADAPTER_TEST_URL;
async function sources(dir){const entries=await fs.readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?sources(path.join(dir,e.name)):/\.(ts|mjs)$/.test(e.name)?[path.join(dir,e.name)]:[]))).flat();}
function staticSql(node){if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=staticSql(node.left),b=staticSql(node.right);return a!==null&&b!==null?a+b:null;}return null;}
test('all static application prepared statements compile against PostgreSQL schema',{skip:!url},async()=>{
 const {Client}=await import('pg');const client=new Client({connectionString:url});await client.connect();
 const found=[{file:"cart-domain",sql:mergeCartSql},{file:"cart-domain",sql:replaceCartVariantSql}];
 for(const file of [...await sources('app/api'),...await sources('lib')]) {
  const tree=ts.createSourceFile(file,await fs.readFile(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='prepare'&&node.arguments[0]){const sql=staticSql(node.arguments[0]);if(sql)found.push({file,sql});}if(ts.isStringLiteral(node)) {
   const text=node.text;
   if(text.startsWith('r.*,'))found.push({file,sql:`SELECT ${text} FROM contents r LEFT JOIN submission_workflows w ON w.id=r.id LEFT JOIN contents c ON c.id=r.id`});
   if(text.startsWith('(instr(')){
    // Partial WHERE expressions need the same table context as their source query.
    // Keep preparing the predicate: mapping a log predicate to contents is a harness error.
    const table=file===path.join('lib','staff-activity-store.ts')?'audit_logs':'contents';
    found.push({file,sql:`SELECT r.id FROM ${table} r WHERE ${text}`});
   }
   if(text.startsWith('(SELECT MIN(CAST('))found.push({file,sql:`SELECT id FROM contents ORDER BY ${text}`});
  }ts.forEachChild(node,visit);}visit(tree);
 }
 assert.ok(found.length>140,`Only found ${found.length} prepared statements`);
 const namespace='adapter_corpus_'+Date.now();const failures=[];
 try {
  await client.query(`CREATE SCHEMA ${namespace}; SET search_path TO ${namespace},public`);
  await client.query(postgresCompatibilitySql);await client.query(await fs.readFile('postgres/001-cms-schema.sql','utf8'));await client.query(await fs.readFile('postgres/003-behavior-events.sql','utf8'));
  for(const [i,item] of found.entries())try{await client.query(`PREPARE corpus_${i} AS ${translateSql(item.sql)}`);}catch(e){failures.push(`${item.file}: ${e.message}\n${item.sql}\n${translateSql(item.sql)}`);}
  assert.deepEqual(failures,[]);console.log(`Validated ${found.length} static application SQL statements`);
  await verifyActivityQueries(client);
 } finally {await client.query(`DEALLOCATE ALL; SET search_path TO public; DROP SCHEMA ${namespace} CASCADE`);await client.end();}
});

async function verifyActivityQueries(client){
 // Execute the real TypeScript query builder through the production PostgreSQL adapter.
 // Only the runtime database binding is injected; SQL and argument construction remain unchanged.
 const source=await fs.readFile('lib/staff-activity-store.ts','utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const database=createPostgresDatabase({query:(...args)=>client.query(...args)});
 const dependencies={'./server':{database:()=>database},'./staff-activity.mjs':{activityModule},'./list-domain.mjs':{modules}};
 const exports={};
 new Function('require','exports',compiled)(name=>{assert.ok(Object.hasOwn(dependencies,name),`Unexpected activity dependency ${name}`);return dependencies[name];},exports);
 for(const [id,actor,action,target,created] of [
  ['activity1','owner@example.test','permission-legacy-orders',JSON.stringify({target:'editor@example.test',before:['view'],after:[]}), '2026-09-14T01:00:00.000Z'],
  ['activity2','editor@example.test','order-approve','order-test','2026-09-14T02:00:00.000Z'],
  ['activity3','editor@example.test','saveContent','content-test','2026-09-13T02:00:00.000Z'],
 ])await database.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?)').bind(id,actor,action,target,created).run();
 const query={actor:'editor@example.test',module:'',action:'',from:'2026-09-14',to:'2026-09-14',page:1,size:30};
 const result=await exports.cmsActivity(query);
 assert.equal(result.total,2);assert.deepEqual(result.rows.map(row=>row.id),['cms:activity2','cms:activity1']);
 assert.deepEqual(result.rows[1].before,['view']);assert.deepEqual(result.rows[1].after,[]);
 assert.equal((await exports.cmsActivity({...query,module:'permissions'})).total,1);
 assert.equal((await exports.cmsActivity({...query,action:'order-approve'})).total,1);
 assert.equal((await exports.cmsActivity({...query,actor:'missing@example.test'})).total,0);
 for(const module of Object.keys(activityModules))await exports.cmsActivity({...query,module});
 const visitorActions=['enable-user','disable-user','save-user-profile','user-profile','visitor-update'];
 for(const operation of visitorActions)await database.prepare('INSERT INTO audit_logs VALUES(?,?,?,?,?)').bind('visitor-'+operation,'visitor-admin@example.test',operation,'visitor-test','2026-09-14T03:00:00.000Z').run();
 const visitorQuery={...query,actor:'visitor-admin@example.test',module:'users'};
 const visitors=await exports.cmsActivity(visitorQuery);
 assert.equal(visitors.total,visitorActions.length);
 assert.deepEqual(visitors.rows.map(row=>row.action).sort(),[...visitorActions].sort());
 assert.ok(visitors.rows.every(row=>row.module==='users'));
 assert.equal((await exports.cmsActivity({...visitorQuery,module:'other'})).total,0);
 console.log('Executed actual activity query builder: actor/target, module, action, dates, counts and snapshot decoding');
}
