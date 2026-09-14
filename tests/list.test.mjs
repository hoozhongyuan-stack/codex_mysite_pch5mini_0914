import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listQuery,
  csv,
  workflowInput,
  submissionEmail,
} from '../lib/list-domain.mjs';
test('pagination rejects malformed or unbounded inputs', () => {
  assert.equal(listQuery(new URLSearchParams()).size, 20);
  for (const q of [
    'page=-1',
    'page=1.5',
    'size=10000',
    'from=bad',
    'from=2026-09-10&to=2026-09-01',
    'sort=DROP',
  ])
    assert.throws(() => listQuery(new URLSearchParams(q)));
  assert.equal(listQuery(new URLSearchParams('size=100&page=3')).page, 3);
});
test('CSV quotes newlines and protects spreadsheet formulas', () => {
  assert.equal(csv([['=cmd', 'a"b', 'x\ny']]), '\uFEFF"\'=cmd","a""b","x\ny"');
});
test('submission workflow separates viewed status and validates notes', () => {
  assert.deepEqual(workflowInput({ status: 'processing', note: ' 已联系 ' }), {
    status: 'processing',
    note: '已联系',
  });
  assert.throws(() => workflowInput({ status: 'read' }));
  assert.throws(() =>
    workflowInput({ status: 'done', note: 'x'.repeat(2001) }),
  );
});

test('email comes from submitted field snapshot, never guessed from labels', () => {
  assert.equal(
    submissionEmail({
      fields: [{ id: 'random', type: 'email' }],
      values: { random: 'hello@example.test' },
    }),
    'hello@example.test',
  );
  assert.equal(
    submissionEmail({
      fields: [{ id: 'random', type: 'text', labelZh: '姓名' }],
      values: { random: 'Jane' },
    }),
    '',
  );
});
