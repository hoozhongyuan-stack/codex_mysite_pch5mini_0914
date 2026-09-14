import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redemptionDetailHref,
  redemptionPoints,
} from '../lib/redemption-view.mjs';
test('redemption links reuse product route and encode slug', () => {
  assert.equal(
    redemptionDetailHref('zh', 'sample journal'),
    ' /zh/products/sample%20journal?purchase=points'.trim(),
  );
});
test('points display only valid enabled redemption variants', () => {
  const row = {
    variants: [
      { key: 'a', enabled: true, pointsPrice: 100 },
      { key: 'b', enabled: false, pointsPrice: 1 },
      { key: 'c', pointsPrice: 200 },
    ],
  };
  assert.equal(redemptionPoints(row), 100);
  assert.equal(redemptionPoints(row, 'c'), 200);
  assert.equal(redemptionPoints(row, 'b'), null);
  assert.equal(redemptionPoints({ variants: [] }), null);
});
