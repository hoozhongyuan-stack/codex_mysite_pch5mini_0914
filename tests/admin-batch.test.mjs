import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectedIds,
  orderExportFilter,
  runBatch,
  pointBatchPermission,
  pendingPointRefund,
} from '../lib/admin-batch.mjs';
test('selection is explicit, bounded and unique', () => {
  for (const value of [[], null, [''], Array(101).fill('a'), ['a', 'a']])
    assert.throws(() => selectedIds(value));
  assert.deepEqual(selectedIds(['a', 'b']), ['a', 'b']);
});
test('export preserves filters and binds input instead of SQL interpolation', () => {
  const r = orderExportFilter({
    q: "x' OR 1=1",
    status: 'pending_ship',
    pointsOnly: true,
    selected: ['a'],
    from: '2026-09-01',
    to: '2026-09-15',
  });
  assert.ok(r.sql.includes('id IN (?)'));
  assert.ok(!r.sql.includes("x'"));
  assert.ok(r.args.includes('PTS'));
  assert.ok(r.args.includes("%x' OR 1=1%"));
  assert.throws(() => orderExportFilter({ selected: [] }));
  assert.throws(() => orderExportFilter({ from: 'invalid' }));
  assert.throws(() =>
    orderExportFilter({ from: '2026-09-15', to: '2026-09-01' }),
  );
});
test('batch keeps per-item failures and completes remaining items', async () => {
  const r = await runBatch(['a', 'b', 'c'], async (id) => {
    if (id === 'b') throw Error('状态已变化');
  });
  assert.deepEqual(
    r.map((x) => x.ok),
    [true, false, true],
  );
  assert.equal(r[1].error, '状态已变化');
});

test('paid point closure requires aftersale authority and only pending refunds can recover', () => {
  assert.equal(pointBatchPermission('close'), 'aftersale');
  assert.equal(pointBatchPermission('ship'), 'fulfill');
  assert.throws(() => pointBatchPermission('refund'));
  const order = {
    currency: 'PTS',
    status: 'closed',
    data: { redemptionState: 'pending' },
  };
  assert.equal(pendingPointRefund(order), true);
  assert.equal(pendingPointRefund({ ...order, currency: 'CNY' }), false);
  assert.equal(pendingPointRefund({ ...order, status: 'pending_ship' }), false);
  assert.equal(
    pendingPointRefund({ ...order, data: { redemptionState: 'settled' } }),
    false,
  );
});
test('dashboard order export keeps channel, all modes and receipt date basis',()=>{
 const r=orderExportFilter({sandbox:'all',channel:'mini',orderType:'cash',dateBasis:'paid',from:'2026-09-01T00:00:00+08:00'});
 assert.ok(!r.sql.includes('sandbox=?'));assert.ok(r.sql.includes('MIN(h.created_at)'));assert.ok(r.sql.includes('currency<>?'));assert.ok(r.args.includes('mini'));
});
