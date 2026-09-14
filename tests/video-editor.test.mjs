import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateVideoSource,
  MAX_VIDEO_BYTES,
  VIDEO_CHUNK_BYTES,
} from '../lib/video-editor.mjs';
test('video picker accepts up to exactly 1 GiB', () => {
  assert.equal(
    validateVideoSource({ name: 'demo.mp4', size: MAX_VIDEO_BYTES }).size,
    1073741824,
  );
});
test('video picker rejects oversized, empty and unsupported files', () => {
  for (const f of [
    { name: 'a.mp4', size: MAX_VIDEO_BYTES + 1 },
    { name: 'a.mp4', size: 0 },
    { name: 'a.pdf', size: 2 },
  ])
    assert.throws(() => validateVideoSource(f));
});
test('1 GiB uploads as 128 bounded chunks', () => {
  assert.equal(MAX_VIDEO_BYTES / VIDEO_CHUNK_BYTES, 128);
});
