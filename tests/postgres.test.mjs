import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translateSql,createPostgresDatabase} from '../lib/postgres.mjs';
test('SQL preserves literal placeholders and quoted aliases',()=>{
 const q=translateSql("SELECT '?' AS titleZh, json_extract(data,'$.channels.mini')=1 FROM contents WHERE id=? AND json_extract(data,'$.revision') IS ?");
 assert.match(q,/\$1/);assert.match(q,/IS NOT DISTINCT FROM \$2/);assert.match(q,/AS "titleZh"/);assert.match(q,/'\?'/);assert.match(q,/CASE/);
});
test('JSON objects are stored as text and ignore insert is conflict-safe',()=>{
 assert.match(translateSql("INSERT OR IGNORE INTO marketing_assets VALUES(?,?,?)"),/ON CONFLICT DO NOTHING$/);
 assert.match(translateSql("SELECT json_object('title',json_extract(data,'$.titleZh')) AS data FROM contents"),/jsonb_build_object/);
 assert.match(translateSql("UPDATE orders SET data=json_set(data,'$.pointsPending',json('false')) WHERE id=?"),/cms_json_set/);
});
test('batch rolls all statements back and releases connection',async()=>{
 const calls=[]; const client={query:async(q)=>{calls.push(q);if(q.startsWith('UPDATE'))throw Error('conflict');return {rows:[],rowCount:1};},release:()=>calls.push('release')};
 const db=createPostgresDatabase({connect:async()=>client});
 await assert.rejects(db.batch([db.prepare('INSERT INTO t VALUES(?)').bind(1),db.prepare('UPDATE t SET n=?').bind(2)]),/conflict/);
 assert.deepEqual(calls.map(x=>x.split(' ')[0]),['BEGIN','INSERT','UPDATE','ROLLBACK','release']);
});
test('bound statements immutable; first returns null; bigint normalized safely',async()=>{
 const seen=[];const db=createPostgresDatabase({query:async(q,p)=>{seen.push(p);return {rows:[{count:'2'}],fields:[{name:'count',dataTypeID:20}],rowCount:1}}});
 const base=db.prepare('SELECT count(*) count FROM t WHERE id=?');const a=base.bind('a'),b=base.bind('b');
 assert.equal((await a.first()).count,2);await b.all();assert.deepEqual(seen,[['a'],['b']]);
 await assert.rejects(base.all(),/parameter/);
});
test('SQL literals are not rewritten as aliases or CAS and implicit camelcase aliases survive',async()=>{
 assert.match(translateSql("SELECT 'AS camelCase IS ?' AS label"),/'AS camelCase IS \?'/);
 const db=createPostgresDatabase({query:async()=>({rows:[{pendingreview:'3'}],fields:[{name:'pendingreview',dataTypeID:20}],rowCount:1})});
 assert.deepEqual(await db.prepare('SELECT count(*) pendingReview FROM orders').first(),{pendingReview:3});
});
test('compound SQL operators and expiration IDs translate without splitting',()=>{
 const sql=translateSql("SELECT lower(hex(randomblob(16))) FROM orders WHERE expires_at<=? AND total>=? AND status<>? AND 'a'||'b'!='c'");
 assert.match(sql,/<= \$1/);assert.match(sql,/>= \$2/);assert.match(sql,/<> \$3/);assert.match(sql,/\|\|/);assert.match(sql,/gen_random_uuid/);
 assert.throws(()=>translateSql('SELECT randomblob(32)'),/Unsupported/);
});
test('address conflict ownership predicate qualifies the existing table',()=>{
 assert.match(translateSql('INSERT INTO order_addresses SELECT ?,?,?,? WHERE 1=1 ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE user_id=excluded.user_id'),/WHERE order_addresses.user_id = excluded.user_id$/);
});
