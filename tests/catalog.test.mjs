import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogPage } from '../lib/catalog-domain.mjs';
const rows = [
  {
    id: 'a',
    kind: 'products',
    categoryId: 'child',
    spu: 'ABC',
    titleZh: '台灯',
    trade: {
      currency: 'CNY',
      inventory: 1,
      variants: [
        { enabled: true, priceMinor: 300 },
        { enabled: false, priceMinor: 1 },
      ],
    },
  },
  {
    id: 'b',
    kind: 'products',
    categoryId: 'root',
    trade: { currency: 'CNY', inventory: 0, variants: [] },
  },
  {
    id: 'c',
    kind: 'products',
    trade: { currency: 'USD', variants: [{ enabled: true, priceMinor: 1 }] },
  },
];
test('catalog includes descendants and searches SPU', () =>
  assert.equal(
    catalogPage(
      rows,
      [{ id: 'child', parent_id: 'root' }],
      'products',
      { q: 'abc' },
      'zh',
      'root',
    ).total,
    1,
  ));
test('catalog currency sort puts unpriced last and excludes disabled variants', () =>
  assert.deepEqual(
    catalogPage(rows, [], 'products', {
      currency: 'CNY',
      sort: 'priceDesc',
    }).rows.map((r) => r.id),
    ['a', 'b'],
  ));
test('catalog requires currency for mixed price sorting and clamps pages', () => {
  const r = catalogPage(rows, [], 'products', {
    sort: 'priceAsc',
    page: '999',
  });
  assert.equal(r.sort, 'default');
  assert.equal(r.page, 1);
});
test('catalog in-stock filter and clearing category', () =>
  assert.equal(
    catalogPage(
      rows,
      [],
      'products',
      { stock: '1', category: '' },
      'zh',
      'root',
    ).total,
    1,
  ));
