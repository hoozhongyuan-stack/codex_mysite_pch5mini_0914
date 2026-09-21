import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_VARIANTS, imageVariant, imageVariantKey } from '../lib/image-variant-domain.mjs';

test('image variants expose only fixed responsive sizes', () => {
  assert.deepEqual(Object.keys(IMAGE_VARIANTS), ['thumb', 'card', 'hero']);
  assert.equal(imageVariant('thumb'), 'thumb');
  assert.equal(imageVariant('card'), 'card');
  assert.equal(imageVariant('hero'), 'hero');
  assert.equal(imageVariant('source'), '');
  assert.equal(imageVariant('../../private'), '');
});

test('image derivative object keys reject unsafe identifiers', () => {
  assert.equal(imageVariantKey('a1B-2', 'card'), 'image-variants/a1B-2/card.webp');
  for (const id of ['', '../source', 'id/next', 'x'.repeat(101)]) {
    assert.throws(() => imageVariantKey(id, 'thumb'), /图片版本无效/);
  }
  assert.throws(() => imageVariantKey('safe', 'original'), /图片版本无效/);
});
