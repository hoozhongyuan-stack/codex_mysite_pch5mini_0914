import {createHash, randomUUID} from 'node:crypto';
import {mkdir, open, readdir, rename, unlink} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {Readable} from 'node:stream';

// One atomic container per object: payload | JSON metadata | uint64 metadata length.
// Keeping both together prevents partial body/metadata updates after interruption.
// This directory is private storage, never a public static-files directory.
const HTTP_FIELDS = {
  contentType: 'content-type', contentLanguage: 'content-language',
  contentDisposition: 'content-disposition', contentEncoding: 'content-encoding',
  cacheControl: 'cache-control', cacheExpiry: 'expires',
};
function objectName(key) {
  if (typeof key !== 'string' || !key || Buffer.byteLength(key) > 1024 || key.startsWith('/') || /[\\\x00-\x1f]/.test(key) || key.split('/').some(p => p === '.' || p === '..')) throw new Error('Invalid storage key');
  return `${createHash('sha256').update(key).digest('hex')}.object`;
}
function metadataHeaders(input = {}) {
  if (input instanceof Headers) return Object.fromEntries(Object.entries(HTTP_FIELDS).filter(([, name]) => input.has(name)).map(([field, name]) => [field, input.get(name)]));
  return Object.fromEntries(Object.entries(HTTP_FIELDS).filter(([field]) => input[field] != null).map(([field]) => [field, input[field] instanceof Date ? input[field].toUTCString() : String(input[field])]));
}
async function* chunks(value) {
  if (value == null) return;
  if (typeof value === 'string') {yield Buffer.from(value); return;}
  if (value instanceof ArrayBuffer) {yield Buffer.from(value); return;}
  if (ArrayBuffer.isView(value)) {yield Buffer.from(value.buffer, value.byteOffset, value.byteLength); return;}
  if (value instanceof Blob) value = value.stream();
  for await (const chunk of value) yield typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
}
async function writeAll(file, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const {bytesWritten} = await file.write(bytes, offset, bytes.length - offset);
    if (!bytesWritten) throw new Error('Storage write made no progress');
    offset += bytesWritten;
  }
}
async function readMetadata(file) {
  const {size} = await file.stat();
  if (size < 8) throw new Error('Invalid storage container');
  const footer = Buffer.alloc(8);
  await file.read(footer, 0, 8, size - 8);
  const length = Number(footer.readBigUInt64BE());
  if (!Number.isSafeInteger(length) || length > 1024 * 1024 || length > size - 8) throw new Error('Invalid storage metadata');
  const bytes = Buffer.alloc(length);
  await file.read(bytes, 0, length, size - 8 - length);
  const metadata = JSON.parse(bytes.toString());
  if (metadata.size !== size - 8 - length) throw new Error('Invalid storage object size');
  return metadata;
}
function objectInfo(metadata) {
  return {...metadata, uploaded: new Date(metadata.uploaded), httpEtag: `"${metadata.etag}"`,
    writeHttpMetadata(headers) {for (const [field, name] of Object.entries(HTTP_FIELDS)) if (metadata.httpMetadata[field] != null) headers.set(name, metadata.httpMetadata[field]);},
  };
}
function byteRange(input, size) {
  if (!input) return {offset: 0, length: size};
  if (input instanceof Headers) {
    const header = input.get('range');
    if (!header) return {offset: 0, length: size};
    const match = /^bytes=(\d*)-(\d*)$/.exec(header);
    if (!match || (!match[1] && !match[2])) throw new Error('Invalid byte range');
    input = match[1] ? {offset: Number(match[1]), ...(match[2] ? {length: Number(match[2]) - Number(match[1]) + 1} : {})} : {suffix: Number(match[2])};
  }
  const offset = input.suffix != null ? Math.max(0, size - input.suffix) : (input.offset ?? 0);
  const length = input.suffix != null ? Math.min(size, input.suffix) : Math.min(input.length ?? size - offset, size - offset);
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || offset >= size || length <= 0) throw new Error('Unsatisfiable byte range');
  return {offset, length};
}

export function createFilesystemBucket(directory) {
  if (!directory) throw new Error('Filesystem storage directory is required');
  const root = resolve(directory);
  async function load(key) {
    const path = join(root, objectName(key));
    let file;
    try {file = await open(path, 'r');} catch (error) {if (error.code === 'ENOENT') return null; throw error;}
    try {
      const metadata = await readMetadata(file);
      if (metadata.key !== key) throw new Error('Storage key mismatch');
      return {file, metadata};
    } catch (error) {await file.close(); throw error;}
  }
  return {
    async put(key, value, options = {}) {
      const name = objectName(key);
      if (options.onlyIf) throw new Error('Conditional storage writes are not supported');
      await mkdir(root, {recursive: true, mode: 0o700});
      const temporary = join(root, `.${randomUUID()}.tmp`);
      const file = await open(temporary, 'wx', 0o600);
      try {
        const digest = createHash('md5'); let size = 0;
        for await (const chunk of chunks(value)) {await writeAll(file, chunk); digest.update(chunk); size += chunk.length;}
        const metadata = {key, size, etag: digest.digest('hex'), version: randomUUID(), uploaded: new Date().toISOString(), httpMetadata: metadataHeaders(options.httpMetadata), customMetadata: {...options.customMetadata}};
        const bytes = Buffer.from(JSON.stringify(metadata));
        if (bytes.length > 1024 * 1024) throw new Error('Storage metadata too large');
        const footer = Buffer.alloc(8); footer.writeBigUInt64BE(BigInt(bytes.length));
        await writeAll(file, bytes); await writeAll(file, footer); await file.sync(); await file.close();
        await rename(temporary, join(root, name));
        const dir = await open(root, 'r'); try {await dir.sync();} finally {await dir.close();}
        return objectInfo(metadata);
      } catch (error) {await file.close().catch(() => {}); await unlink(temporary).catch(() => {}); throw error;}
    },
    async head(key) {
      const result = await load(key); if (!result) return null;
      try {return objectInfo(result.metadata);} finally {await result.file.close();}
    },
    async get(key, options = {}) {
      if (options.onlyIf) throw new Error('Conditional storage reads are not supported');
      const result = await load(key); if (!result) return null;
      const {file, metadata} = result;
      try {
        const range = byteRange(options.range, metadata.size);
        let body;
        if (!range.length) {await file.close(); body = new ReadableStream({start(c) {c.close();}});}
        else body = Readable.toWeb(file.createReadStream({start: range.offset, end: range.offset + range.length - 1, autoClose: true}));
        const response = new Response(body);
        return {...objectInfo(metadata), range, body: response.body,
          get bodyUsed() {return response.bodyUsed;},
          arrayBuffer: () => response.arrayBuffer(), text: () => response.text(), json: () => response.json(), blob: () => response.blob(),
        };
      } catch (error) {await file.close(); throw error;}
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        try {await unlink(join(root, objectName(key)));} catch (error) {if (error.code !== 'ENOENT') throw error;}
      }
    },
    async list(options = {}) {
      if (options.delimiter) throw new Error('Delimited storage listing is not supported');
      const limit = options.limit ?? 1000;
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid list limit');
      let names; try {names = await readdir(root);} catch (error) {if (error.code === 'ENOENT') names = []; else throw error;}
      const objects = [];
      for (const name of names.filter(n => /^[a-f0-9]{64}\.object$/.test(n))) {
        let file;
        try {file = await open(join(root, name), 'r'); objects.push(objectInfo(await readMetadata(file)));}
        catch (error) {if (error.code !== 'ENOENT') throw error;}
        finally {if (file) await file.close();}
      }
      const after = options.cursor ? Buffer.from(options.cursor, 'base64url').toString() : '';
      const matched = objects.filter(o => o.key.startsWith(options.prefix ?? '') && o.key > after).sort((a, b) => a.key < b.key ? -1 : 1);
      const page = matched.slice(0, limit); const truncated = matched.length > limit;
      return {objects: page, truncated, delimitedPrefixes: [], ...(truncated ? {cursor: Buffer.from(page.at(-1).key).toString('base64url')} : {})};
    },
  };
}
