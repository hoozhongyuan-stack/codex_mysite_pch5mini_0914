import test from 'node:test';
import assert from 'node:assert/strict';
import {
  miniToken,
  channelPredicate,
  miniPayments,
} from '../lib/mini-business.mjs';
test('mini bearer is explicit and never falls back to website cookies', () => {
  assert.equal(miniToken('Bearer ' + 'a'.repeat(43)), 'a'.repeat(43));
  for (const v of [
    '',
    'Basic abc',
    'Bearer a',
    'Bearer ' + 'a'.repeat(43) + ' extra',
  ])
    assert.throws(() => miniToken(v));
});
test('content channel cannot inject SQL or change implicitly', () => {
  assert.match(channelPredicate('mini'), /mini/);
  assert.match(channelPredicate('website'), /website/);
  assert.throws(() => channelPredicate('bad'));
});
test('payment switches are separate and default closed; incomplete online mode rejects', () => {
  assert.deepEqual(miniPayments({}), { offline: false, wechat: false });
  assert.deepEqual(miniPayments({ offline: true }), {
    offline: true,
    wechat: false,
  });
  assert.throws(() => miniPayments({ wechat: true }, false));
  assert.equal(miniPayments({ wechat: true }, true).wechat, true);
});

test('database enforces channel at actual order item insertion', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { readFileSync } = await import('node:fs');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE orders(id TEXT,data TEXT);CREATE TABLE contents(id TEXT,status TEXT,data TEXT);CREATE TABLE order_items(order_id TEXT,product_id TEXT)',
  );
  db.exec(
    readFileSync(
      new URL('../drizzle/0012_order_channel_guard.sql', import.meta.url),
      'utf8',
    ),
  );
  db.prepare('INSERT INTO orders VALUES(?,?)').run(
    'm',
    JSON.stringify({ sourceEnd: 'mini' }),
  );
  db.prepare('INSERT INTO orders VALUES(?,?)').run('w', '{}');
  db.prepare('INSERT INTO contents VALUES(?,?,?)').run(
    'p',
    'published',
    JSON.stringify({ channels: { website: true, mini: false } }),
  );
  assert.throws(() => db.exec("INSERT INTO order_items VALUES('m','p')"));
  db.exec("INSERT INTO order_items VALUES('w','p')");
  db.prepare('UPDATE contents SET data=?').run(
    JSON.stringify({ channels: { website: false, mini: true } }),
  );
  assert.throws(() => db.exec("INSERT INTO order_items VALUES('w','p')"));
  db.exec("INSERT INTO order_items VALUES('m','p')");
  db.close();
});
