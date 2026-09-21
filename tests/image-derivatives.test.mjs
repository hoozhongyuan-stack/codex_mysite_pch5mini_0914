import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { IMAGE_VARIANTS } from '../lib/image-variant-domain.mjs';

test('sharp produces bounded WebP derivatives without enlarging the source', async () => {
  const source = await sharp({create: {width: 40, height: 20, channels: 3, background: '#31573f'}}).png().toBuffer();
  for (const specification of Object.values(IMAGE_VARIANTS)) {
    const output = await sharp(source)
      .rotate()
      .resize({width: specification.width, withoutEnlargement: true})
      .webp({quality: specification.quality})
      .toBuffer({resolveWithObject: true});
    assert.equal(output.info.format, 'webp');
    assert.equal(output.info.width, 40);
    assert.equal(output.info.height, 20);
    assert.ok(output.info.size > 0);
  }
});
