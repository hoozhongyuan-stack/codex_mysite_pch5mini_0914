import test from 'node:test';
import assert from 'node:assert/strict';
import { patchAdminQuery, adminTrail } from '../lib/admin-navigation.mjs';

test('detail navigation keeps list filters and returns to the same list', () => {
  const detail = patchAdminQuery('?view=orders&q=lamp&page=3&status=paid', { order: 'abc' });
  assert.equal(new URLSearchParams(detail).get('page'), '3');
  assert.equal(patchAdminQuery(detail, { order: '' }), '?view=orders&q=lamp&page=3&status=paid');
});
test('only explicitly provided query values change, encoding ids safely', () => {
  const next = new URLSearchParams(patchAdminQuery('?view=marketing', { salon: 'a&b', salonTab: 'stats' }));
  assert.equal(next.get('salon'), 'a&b');
  assert.equal(next.get('salonTab'), 'stats');
});
test('nested salon, video, order and configuration trails show the actual location', () => {
  assert.deepEqual(adminTrail('marketing', '?salon=abc&salonTab=stats').map(x=>x.label), ['沙龙会','活动详情','统计与签到']);
  assert.deepEqual(adminTrail('videoSeries', '?series=abc').map(x=>x.label), ['系列详情']);
  assert.deepEqual(adminTrail('orders', '?order=abc').map(x=>x.label), ['订单详情']);
  assert.deepEqual(adminTrail('settings', '?settingsTab=smtp').map(x=>x.label), ['邮件服务']);
  assert.deepEqual(adminTrail('marketing', ''), []);
});
