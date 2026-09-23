import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const fromVinext = createRequire(import.meta.resolve('vinext'));
const entry = fromVinext.resolve('image-size');
const cjs = fromVinext('image-size');
const esmRoot = join(dirname(dirname(entry)), 'esm');
const esm = await import(pathToFileURL(join(esmRoot, 'index.js')).href);
const icns = Uint8Array.from([
  105, 99, 110, 115, 0, 0, 0, 16, 105, 99, 48, 55, 0, 0, 0, 0,
]);
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cP1sAAAAASUVORK5CYII=',
    'base64',
  ),
);
for (const [name, api] of [
  ['CommonJS', cjs],
  ['ESM', esm],
]) {
  test(
    name +
      ' rejects malformed ICNS even after caller clears optional disabled list',
    () => {
      api.disableTypes([]);
      assert.throws(() => api.imageSize(icns), /Invalid ICNS/);
    },
  );
  test(name + ' still reads permitted PNG', () => {
    const size = api.imageSize(png);
    assert.equal(size.width, 1);
    assert.equal(size.height, 1);
  });
}
for (const type of ['heif', 'icns', 'jxl'])
  test('direct ' + type + ' handlers reject malformed input', async () => {
    const mod = await import(
      pathToFileURL(join(esmRoot, 'types', type + '.js')).href
    );
    const handlers = Object.values(mod).filter(
      (v) => v && typeof v.calculate === 'function',
    );
    assert.ok(handlers.length);
    for (const handler of handlers)
      assert.throws(
        () => handler.calculate(new Uint8Array(32)),
        /Invalid/,
      );
  });
