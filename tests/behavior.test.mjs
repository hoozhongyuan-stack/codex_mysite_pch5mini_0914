import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, summarizeBehavior } from '../lib/behavior-domain.mjs';
const input = {
  id: 'a'.repeat(20),
  visitorId: 'v'.repeat(20),
  sessionId: 's'.repeat(20),
  event: 'page_view',
  path: '/zh/shop/test',
  consent: true,
  channel: 'website',
};
test('behavior rejects unconsented, wrong channel and private payload; normalizes pathname', () => {
  assert.equal(
    normalizeEvent({ ...input, path: '/zh/shop/test?q=secret' }, 'website')
      .path,
    '/zh/shop/test',
  );
  for (const patch of [
    { consent: false },
    { channel: 'mini' },
    { email: 'private@example.test' },
    { event: 'payment' },
    { target: 'a@b.com' },
  ])
    assert.throws(() => normalizeEvent({ ...input, ...patch }, 'website'));
  assert.equal(
    normalizeEvent({ ...input, path: '/zh/orders/private-id' }, 'website').path,
    '/zh/orders',
  );
});
test('behavior visitor dedup is channel-specific and funnel requires ordered events in same session', () => {
  const row = (event, time, session = 's', channel = 'website') => ({
    event,
    created_at: `2026-09-14T0${time}:00:00Z`,
    session_hash: session,
    visitor_hash: 'v',
    channel,
    target: 'article-one',
    path: '/zh',
  });
  const result = summarizeBehavior([
    row('order_submit', 1),
    row('page_view', 2),
    row('cart_add', 3),
    row('checkout_start', 4),
    row('order_submit', 5),
    row('page_view', 2, 'x', 'mini'),
  ]);
  assert.equal(result.visitors, 2);
  assert.equal(result.views, 2);
  assert.deepEqual(
    result.funnel.map((x) => x.count),
    [2, 1, 1, 1],
  );
  assert.equal(
    summarizeBehavior([row('page_view', 2), row('order_submit', 3)]).funnel[3]
      .count,
    0,
  );
});
test('private targets are discarded; video completion without start cannot inflate rate', () => {
  assert.equal(
    normalizeEvent(
      { ...input, path: '/pages/checkout/index', target: '13800138000' },
      'website',
    ).target,
    '',
  );
  const rows = [
    {
      event: 'video_complete',
      channel: 'mini',
      session_hash: 's',
      visitor_hash: 'v',
      target: 'clip',
      created_at: '2026-09-14T00:00:00Z',
    },
  ];
  assert.equal(summarizeBehavior(rows).videoComplete, 0);
  assert.throws(() =>
    normalizeEvent({ ...input, path: '//evil.example' }, 'website'),
  );
  assert.throws(() => normalizeEvent({ ...input, id: 'x' }, 'website'));
});
