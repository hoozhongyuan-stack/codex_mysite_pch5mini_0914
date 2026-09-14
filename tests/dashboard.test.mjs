import test from 'node:test';
import assert from 'node:assert/strict';
import {
  period,
  summarizeTrade,
  series,
  sourceChannel,
  delta,
} from '../lib/dashboard-domain.mjs';
test('China calendar boundaries and preceding equal period', () => {
  const p = period({ start: '2026-09-01', end: '2026-09-08' });
  assert.equal(p.startAt, '2026-08-31T16:00:00.000Z');
  assert.equal(p.previousStart, '2026-08-24T16:00:00.000Z');
  assert.throws(() => period({ start: '2026-02-30', end: '2026-03-01' }));
  assert.throws(() => period({ start: '2025-01-01', end: '2026-09-01' }));
});
test('first receipt only, currencies separate, points excluded, refunds by event', () => {
  const p = period({ start: '2026-09-01', end: '2026-09-08' });
  const orders = [
    {
      id: 'a',
      currency: 'CNY',
      total: 10000,
      first_paid: '2026-09-01T01:00:00Z',
    },
    {
      id: 'b',
      currency: 'USD',
      total: 500,
      first_paid: '2026-08-29T00:00:00Z',
    },
    { id: 'p', currency: 'PTS', total: 50, first_paid: '2026-09-01T00:00:00Z' },
  ];
  const r = summarizeTrade(
    orders,
    [{ currency: 'CNY', amount: 2000, created_at: '2026-09-02T00:00:00Z' }],
    p,
  );
  assert.equal(r.current, 1);
  assert.equal(r.previous, 1);
  assert.deepEqual(r.money, [
    { currency: 'CNY', previousReceived: 0, received: 10000, refunded: 2000 },
    { currency: 'USD', previousReceived: 500, received: 0, refunded: 0 },
  ]);
  assert.equal(
    r.daily.reduce((s, x) => s + x.count, 0),
    1,
  );
});
test('unknown source stays unknown and series fills empty dates', () => {
  assert.equal(sourceChannel(null), 'unknown');
  assert.equal(sourceChannel('pc'), 'website');
  assert.equal(
    series([], period({ start: '2026-09-01', end: '2026-09-03' })).length,
    2,
  );
  assert.equal(delta(1, 0), '新增');
  assert.equal(delta(0, 0), '持平');
});
