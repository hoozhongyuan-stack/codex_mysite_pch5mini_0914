import test from 'node:test';
import assert from 'node:assert/strict';
import { contentChannels, channelVisible } from '../lib/content-channels.mjs';
test('legacy content remains website-only and draft never public', () => {
  assert.deepEqual(contentChannels(), { website: true, mini: false });
  assert.equal(channelVisible({ status: 'published' }, 'mini'), false);
  assert.equal(channelVisible({ status: 'published' }, 'website'), true);
  assert.equal(
    channelVisible({ status: 'draft', channels: { mini: true } }, 'mini'),
    false,
  );
});
test('channels validate booleans and reject unknown fields', () => {
  assert.throws(() => contentChannels({ mini: 'true' }));
  assert.throws(() => contentChannels({ other: true }));
  assert.equal(
    channelVisible(
      { status: 'published', channels: { website: false, mini: true } },
      'website',
    ),
    false,
  );
});
