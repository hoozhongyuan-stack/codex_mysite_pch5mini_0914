import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
test('database prevents category cycles, third levels and deletion of referenced parents', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      readFileSync(
        new URL('../drizzle/0000_gray_stephen_strange.sql', import.meta.url),
        'utf8',
      ),
    );
    db.exec(
      readFileSync(
        new URL('../drizzle/0001_plain_drax.sql', import.meta.url),
        'utf8',
      ),
    );
    const insert = db.prepare('INSERT INTO categories VALUES(?,?,?,?)');
    insert.run('a', 'products', null, '{}');
    insert.run('b', 'products', null, '{}');
    db.prepare('UPDATE categories SET parent_id=? WHERE id=?').run('b', 'a');
    assert.throws(() =>
      db.prepare('UPDATE categories SET parent_id=? WHERE id=?').run('a', 'b'),
    );
    assert.throws(() => insert.run('c', 'products', 'a', '{}'));
    assert.throws(() => insert.run('c', 'products', 'missing', '{}'));
    assert.throws(() =>
      db.prepare('DELETE FROM categories WHERE id=?').run('b'),
    );
  } finally {
    db.close();
  }
});
test('articles support two levels with database cycle and cross-kind protection', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const name of [
      '0000_gray_stephen_strange.sql',
      '0001_plain_drax.sql',
      '0006_article_category_hierarchy.sql',
    ])
      db.exec(
        readFileSync(new URL('../drizzle/' + name, import.meta.url), 'utf8'),
      );
    const put = db.prepare('INSERT INTO categories VALUES(?,?,?,?)');
    put.run('a', 'articles', null, '{}');
    put.run('b', 'articles', 'a', '{}');
    assert.throws(() => put.run('c', 'articles', 'b', '{}'));
    assert.throws(() => put.run('p', 'products', 'a', '{}'));
    assert.throws(() =>
      db.prepare('UPDATE categories SET parent_id=? WHERE id=?').run('b', 'a'),
    );
    assert.throws(() =>
      db.prepare('DELETE FROM categories WHERE id=?').run('a'),
    );
  } finally {
    db.close();
  }
});
