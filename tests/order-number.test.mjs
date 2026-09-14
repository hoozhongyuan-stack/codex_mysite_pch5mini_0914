import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
const migration = readFileSync(
  new URL('../drizzle/0009_worthless_wallow.sql', import.meta.url),
  'utf8',
);
function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE orders(id TEXT PRIMARY KEY,created_at TEXT,data TEXT,sandbox INTEGER)',
  );
  return db;
}
function add(
  db,
  id,
  date = '2026-09-09T16:00:00.000Z',
  country = 'CN',
  sandbox = 0,
) {
  db.prepare(
    'INSERT INTO orders(id,created_at,data,sandbox) VALUES(?,?,?,?)',
  ).run(id, date, JSON.stringify({ address: { country } }), sandbox);
}
test('backfill and new numbers use Shanghai day, daily sequence and sandbox prefix', () => {
  const db = setup();
  add(db, 'old', '2026-09-09T15:59:59.000Z', '中国');
  db.exec(migration);
  add(db, 'a');
  add(db, 'b', undefined, 'US', 1);
  const rows = db.prepare('SELECT order_number FROM orders ORDER BY id').all();
  assert.deepEqual(
    rows.map((r) => r.order_number),
    [
      '20260910000000-CN-000001',
      'TEST-20260910000000-US-000002',
      '20260909235959-CN-000001',
    ],
  );
  assert.throws(() =>
    db.exec("UPDATE orders SET order_number='changed' WHERE id='a'"),
  );
  db.close();
});
test('rolled back creation does not consume a sequence and explicit numbers are rejected', () => {
  const db = setup();
  db.exec(migration);
  db.exec('BEGIN');
  add(db, 'gone');
  db.exec('ROLLBACK');
  add(db, 'kept');
  assert.equal(
    db.prepare('SELECT order_number FROM orders').get().order_number,
    '20260910000000-CN-000001',
  );
  assert.throws(() =>
    db.exec("INSERT INTO orders VALUES('bad','2026-09-09','{}',0,'custom')"),
  );
  db.close();
});
