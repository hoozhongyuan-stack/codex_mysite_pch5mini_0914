import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBrand, brandAssetIds } from '../lib/brand-domain.mjs';
test('brand accepts independent image ids and rejects external URLs', () => {
  assert.deepEqual(
    brandAssetIds(
      validateBrand({ logoId: 'a-1', faviconId: 'b-2', showName: false }),
    ),
    ['a-1', 'b-2'],
  );
  assert.throws(() =>
    validateBrand({ logoId: 'https://a', faviconId: '', showName: true }),
  );
  assert.throws(() =>
    validateBrand({ logoId: '', faviconId: '', showName: 'yes' }),
  );
});
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
test('database protects brand assets and rejects missing references', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      'CREATE TABLE assets(id TEXT PRIMARY KEY); CREATE TABLE settings(id TEXT PRIMARY KEY,data TEXT);',
    );
    db.exec(
      readFileSync(
        new URL('../drizzle/0010_brand_asset_guards.sql', import.meta.url),
        'utf8',
      ),
    );
    db.exec("INSERT INTO assets VALUES('logo');");
    assert.throws(() =>
      db
        .prepare('INSERT INTO settings VALUES(?,?)')
        .run('site', JSON.stringify({ brand: { logoId: 'missing' } })),
    );
    db.prepare('INSERT INTO settings VALUES(?,?)').run(
      'site',
      JSON.stringify({ brand: { logoId: 'logo' } }),
    );
    assert.throws(() => db.exec("DELETE FROM assets WHERE id='logo'"));
    assert.throws(() =>
      db
        .prepare('UPDATE settings SET data=?')
        .run(JSON.stringify({ brand: { faviconId: 'missing' } })),
    );
    db.exec(
      "UPDATE settings SET data='{}';DELETE FROM assets WHERE id='logo';",
    );
  } finally {
    db.close();
  }
});
