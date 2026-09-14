import test from 'node:test';
import assert from 'node:assert/strict';
import { allowsFormalEventSave } from '../lib/marketing-mode.mjs';

test('formal event saves work while simulation creation and republication are blocked', () => {
  assert.equal(allowsFormalEventSave({ status: 'published' }), true);
  assert.equal(allowsFormalEventSave({ status: 'draft', test: false }), true);
  assert.equal(allowsFormalEventSave({ status: 'draft', test: true }), false);
  assert.equal(allowsFormalEventSave({ id: 'invented', status: 'archived', test: true }), false);
  const historical = { test: true };
  assert.equal(allowsFormalEventSave({ test: true, status: 'archived' }, historical), true);
  assert.equal(allowsFormalEventSave({ test: true, status: 'draft' }, historical), true);
  assert.equal(allowsFormalEventSave({ test: true, status: 'published' }, historical), false);
  assert.equal(allowsFormalEventSave({ test: false, status: 'published' }, historical), false);
});
