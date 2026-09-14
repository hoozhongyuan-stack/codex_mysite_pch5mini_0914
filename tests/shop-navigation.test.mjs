import test from 'node:test';
import assert from 'node:assert/strict';
import { safeShopReturn, accountLanguageHref, orderErrorText } from '../lib/shop-navigation.mjs';
test('account language retains local order, cart and product destinations', () => {
  assert.equal(accountLanguageHref('zh', '/en/orders/abc'), '/zh/account?returnTo=%2Fzh%2Forders%2Fabc');
  assert.equal(accountLanguageHref('en', '/zh/cart?product=abc&variant=default'), '/en/account?returnTo=%2Fen%2Fcart%3Fproduct%3Dabc%26variant%3Ddefault');
  assert.equal(safeShopReturn('/zh/products/demo'), '/zh/products/demo');
});
test('return destination rejects external, encoded and unrelated routes', () => {
  for (const value of ['//evil.test', '/zh/orders/../../login', '/zh/orders/\\evil', '/zh/orders/%2e%2e/admin', 'https://evil.test', '/api/admin', ['/zh/cart']]) assert.equal(safeShopReturn(value), '');
});
test('order errors localize sign-in and network failures without hiding Chinese details', () => {
  assert.equal(orderErrorText({status:401}, true), 'Please sign in to continue.');
  assert.equal(orderErrorText(new TypeError('Failed to fetch'), false), '连接失败，请稍后重试。');
  assert.equal(orderErrorText(new Error('库存不足'), false), '库存不足');
  assert.equal(orderErrorText(new Error('库存不足'), true), 'Insufficient stock. Please reduce the quantity.');
});

test('member and interaction destinations survive login without allowing admin routes', () => {
 for (const path of ['/zh/account?section=points','/en/points-shop','/zh/articles/demo','/en/videos/demo']) assert.equal(safeShopReturn(path),path);
 assert.equal(safeShopReturn('/zh/admin'),'');
});
