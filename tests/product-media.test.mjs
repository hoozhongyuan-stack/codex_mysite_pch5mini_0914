import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../lib/domain.mjs';
const base = {
  kind: 'products',
  slug: 'test',
  status: 'draft',
  titleZh: '商品',
};
test('product gallery is ordered, bounded, unique and falls back to old cover', () => {
  assert.deepEqual(validateContent({ ...base, imageId: 'old' }).imageIds, [
    'old',
  ]);
  assert.deepEqual(
    validateContent({ ...base, imageIds: ['b', 'a'], spu: ' Ab-01 ' }).imageIds,
    ['b', 'a'],
  );
  assert.equal(validateContent({ ...base, imageIds: ['b', 'a'] }).imageId, 'b');
  assert.throws(() => validateContent({ ...base, imageIds: ['a', 'a'] }));
  assert.throws(() =>
    validateContent({
      ...base,
      imageIds: Array.from({ length: 11 }, (_, i) => String(i)),
    }),
  );
});
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
test('database rejects duplicate SPU without affecting empty codes', () => {
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
        new URL('../drizzle/0004_youthful_pepper_potts.sql', import.meta.url),
        'utf8',
      ),
    );
    const put = db.prepare('INSERT INTO contents VALUES(?,?,?,?,?,?,?)');
    put.run(
      '1',
      'products',
      'one',
      'draft',
      JSON.stringify({ spu: 'ABC' }),
      'now',
      'now',
    );
    assert.throws(() =>
      put.run(
        '2',
        'products',
        'two',
        'draft',
        JSON.stringify({ spu: 'abc' }),
        'now',
        'now',
      ),
    );
    put.run('3', 'products', 'three', 'draft', '{}', 'now', 'now');
    put.run('4', 'products', 'four', 'draft', '{}', 'now', 'now');
  } finally {
    db.close();
  }
});
test('database prevents dangling asset and folder references and deleting in-use assets', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of [
      '0000_gray_stephen_strange.sql',
      '0001_plain_drax.sql',
      '0005_asset_reference_guards.sql',
    ])
      db.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
    assert.throws(() =>
      db
        .prepare('INSERT INTO content_assets VALUES(?,?,?)')
        .run('ref', 'content', 'missing'),
    );
    db.prepare('INSERT INTO assets VALUES(?,?,?,?,?)').run(
      'image',
      'image.png',
      'image/png',
      100,
      'now',
    );
    db.prepare('INSERT INTO content_assets VALUES(?,?,?)').run(
      'ref',
      'content',
      'image',
    );
    assert.throws(() =>
      db.prepare('DELETE FROM assets WHERE id=?').run('image'),
    );
    assert.throws(() =>
      db
        .prepare('INSERT INTO asset_folders_map VALUES(?,?)')
        .run('image', 'missing'),
    );
    assert.throws(() =>
      db
        .prepare('INSERT INTO settings VALUES(?,?)')
        .run('site', JSON.stringify({ footer: { logoId: 'missing' } })),
    );
  } finally {
    db.close();
  }
});
