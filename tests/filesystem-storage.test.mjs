import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFilesystemBucket} from '../lib/filesystem-storage.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'bucket-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return {root, bucket: createFilesystemBucket(root)};
}
test('filesystem bucket round trips bytes and metadata across adapter restarts', async t => {
  const {root, bucket} = await fixture(t);
  await bucket.put('orders/one', 'hello world', {httpMetadata: {contentType: 'text/plain'}, customMetadata: {owner: 'member'}});
  const object = await createFilesystemBucket(root).get('orders/one');
  assert.equal(await object.text(), 'hello world');
  assert.equal(object.size, 11);
  assert.equal(object.customMetadata.owner, 'member');
  const headers = new Headers(); object.writeHttpMetadata(headers);
  assert.equal(headers.get('content-type'), 'text/plain');
  assert.equal((await bucket.head('orders/one')).etag, object.etag);
  assert.equal(await bucket.get('missing'), null);
});
test('filesystem bucket supports streamed writes and byte ranges', async t => {
  const {bucket} = await fixture(t);
  const stream = new ReadableStream({start(c) {c.enqueue(new TextEncoder().encode('abcdef')); c.close();}});
  await bucket.put('video', stream);
  assert.equal(await (await bucket.get('video', {range: {offset: 2, length: 3}})).text(), 'cde');
  assert.equal(await (await bucket.get('video', {range: {suffix: 2}})).text(), 'ef');
  assert.equal(await (await bucket.get('video', {range: new Headers({range: 'bytes=1-2'})})).text(), 'bc');
  await assert.rejects(bucket.get('video', {range: {offset: 7}}), /range/i);
});
test('filesystem bucket replacement is atomic and failed stream preserves previous object', async t => {
  const {bucket} = await fixture(t);
  await bucket.put('same', 'old');
  const pendingRead = await bucket.get('same');
  await bucket.put('same', 'new');
  assert.equal(await pendingRead.text(), 'old');
  const broken = new ReadableStream({pull(c) {c.error(new Error('write interrupted'));}});
  await assert.rejects(bucket.put('same', broken), /interrupted/);
  assert.equal(await (await bucket.get('same')).text(), 'new');
});
test('filesystem bucket paginates prefixes and deletes without key path traversal', async t => {
  const {root, bucket} = await fixture(t);
  for (const key of ['a/1', 'a/2', 'b/3']) await bucket.put(key, key);
  const first = await bucket.list({prefix: 'a/', limit: 1});
  assert.deepEqual(first.objects.map(o => o.key), ['a/1']);
  assert.equal(first.truncated, true);
  const second = await bucket.list({prefix: 'a/', limit: 1, cursor: first.cursor});
  assert.deepEqual(second.objects.map(o => o.key), ['a/2']);
  await bucket.delete(['a/1', 'a/2']);
  assert.equal((await bucket.list()).objects.length, 1);
  for (const key of ['../escape', '/absolute', 'foo/../escape', 'foo\\bar', '']) await assert.rejects(bucket.put(key, 'bad'), /key/i);
  assert.equal((await readdir(root)).some(n => n.includes('escape')), false);
});
test('empty and binary objects preserve exact bytes, Headers metadata, and reject unsupported conditions', async t => {
  const {bucket} = await fixture(t);
  await bucket.put('empty', null);
  assert.equal(await (await bucket.get('empty')).text(), '');
  await bucket.put('binary', new Uint8Array([0, 255, 128]), {httpMetadata: new Headers({'content-type': 'image/png'})});
  const binary = await bucket.get('binary');
  assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())], [0, 255, 128]);
  assert.equal(binary.httpMetadata.contentType, 'image/png');
  await assert.rejects(bucket.put('binary', 'bad', {onlyIf: {etagMatches: 'wrong'}}), /Conditional/);
  await assert.rejects(bucket.get('binary', {onlyIf: {etagMatches: 'wrong'}}), /Conditional/);
});
