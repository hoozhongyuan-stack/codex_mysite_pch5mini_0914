import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceView, selectedAssetId } from '../lib/workspace-route.mjs';
test('new workspace routes survive entry validation and retired actions return to orders', () => {
  assert.equal(workspaceView('commerce'), 'commerce');
  assert.equal(workspaceView('permissions'), 'permissions');
  assert.equal(workspaceView('videos'), 'videos');
  assert.equal(workspaceView('payments'), 'orders');
  assert.equal(workspaceView('aftersales'), 'orders');
  assert.equal(workspaceView('folders'), 'assets');
  assert.equal(workspaceView('invalid'), 'overview');
});
test('single asset selection reads object id', () => {
  assert.equal(selectedAssetId({ id: 'logo-1' }), 'logo-1');
  assert.equal(selectedAssetId(null), '');
});
