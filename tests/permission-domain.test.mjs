import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyOrderUpdate, legacyOrderSql } from '../lib/permission-domain.mjs';
import { DatabaseSync } from 'node:sqlite';
test('legacy grant update changes only selected email and detects stale revisions', () => {
  const old = { methods: [{ id: 'bank' }], grants: { 'a@example.test': ['view'], 'b@example.test': ['finance'] } };
  const next = legacyOrderUpdate(old, { email: 'a@example.test', permissions: [], previous: ['view'] });
  assert.deepEqual(next.grants['a@example.test'], []);
  assert.deepEqual(next.grants['b@example.test'], ['finance']);
  assert.deepEqual(next.methods, old.methods);
  assert.deepEqual(old.grants['a@example.test'], ['view']);
  assert.throws(() => legacyOrderUpdate(old, { email: 'a@example.test', permissions: ['view'], previous: [] }), /更新/);
  assert.throws(() => legacyOrderUpdate(old, { email: 'a@example.test', permissions: ['owner'], previous: ['view'] }), /权限/);
  assert.throws(() => legacyOrderUpdate(old, { email: 'new@example.test', permissions: ['view'], previous: [] }), /历史/);
});
test('legacy grant compare-and-swap and audit are atomic; stale writes do not emit success records', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE settings(id TEXT PRIMARY KEY,data TEXT); CREATE TABLE audit_logs(id TEXT PRIMARY KEY,actor TEXT,action TEXT,target TEXT,created_at TEXT)');
    const before = JSON.stringify({ enabled: true, grants: { 'a@example.test': ['view'] } });
    db.prepare('INSERT INTO settings VALUES(?,?)').run('commerce',before);
    const save = (old, marker, auditId) => {
      db.exec('BEGIN');
      try {
        const result=db.prepare(legacyOrderSql.update).run(JSON.stringify({enabled:true,grants:{'a@example.test':[]},permissionRevision:marker}),old);
        db.prepare(legacyOrderSql.audit).run(auditId,'owner@example.test','snapshot','2026-09-14T00:00:00Z',marker);
        db.exec('COMMIT');
        return result.changes;
      } catch(error) {db.exec('ROLLBACK');throw error;}
    };
    assert.equal(save(before,'m1','audit1'),1);
    assert.equal(save(before,'m2','audit2'),0);
    assert.equal(db.prepare('SELECT count(*) AS total FROM audit_logs').get().total,1);
    const latest=db.prepare('SELECT data FROM settings').get().data;
    assert.throws(()=>save(latest,'m3','audit1'));
    assert.equal(db.prepare('SELECT data FROM settings').get().data,latest);
  } finally { db.close(); }
});
