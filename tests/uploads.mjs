import assert from 'node:assert/strict';
const base = 'http://localhost:3001';
const login = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
  redirect: 'manual',
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
async function upload(bytes, mime, auth = true) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), 'qa-upload.png');
  return fetch(base + '/api/upload', {
    method: 'POST',
    headers: { Origin: base, ...(auth ? { cookie } : {}) },
    body: form,
  });
}
assert.equal((await upload('not-a-png', 'image/png')).status, 400);
assert.equal((await upload('<svg/>', 'image/svg+xml')).status, 400);
assert.equal((await upload('no', 'image/png', false)).status, 401);
const png = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cP1sAAAAASUVORK5CYII=',
    'base64',
  ),
);
const response = await upload(png, 'image/png');
assert.equal(response.status, 200);
const asset = await response.json();
assert.equal((await fetch(base + '/api/media/' + asset.id)).status, 401);
const read = await fetch(base + '/api/media/' + asset.id, {
  headers: { cookie },
});
assert.equal(read.status, 200);
assert.equal(read.headers.get('content-type'), 'image/png');
assert.equal((await read.arrayBuffer()).byteLength, png.length);
const oversized = await fetch(base + '/api/admin', {
  method: 'POST',
  headers: { cookie, Origin: base, 'Content-Type': 'application/json' },
  body: JSON.stringify({ padding: 'x'.repeat(250001) }),
});
assert.equal(oversized.status, 413);
console.log(JSON.stringify({ passed: 8, assetId: asset.id }, null, 2));
