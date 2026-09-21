#!/usr/bin/env node
/**
 * Generate derived WebP files in persistent private storage.
 * Originals are never replaced. This Node process is intentionally separate
 * from the Worker-compatible web runtime because sharp needs native Node APIs.
 */
import { createRequire } from 'node:module';
import { createFilesystemBucket } from '../lib/filesystem-storage.mjs';
import { IMAGE_VARIANTS, imageVariantKey } from '../lib/image-variant-domain.mjs';

// UAT packages production dependencies under web/node_modules, while local
// development resolves from this repository. Keep the path explicit rather
// than copying native sharp binaries between macOS and Linux releases.
const require = createRequire(process.env.IMAGE_NODE_MODULES || import.meta.url);
const sharp = require('sharp');
const pg = require('pg');

const once = process.argv.includes('--once');
const loop = process.argv.includes('--loop');
if (once && loop) throw Error('Choose --once or --loop');
const required = (name) => {
  const value = process.env[name];
  if (!value) throw Error(`${name} is required`);
  return value;
};
const db = new pg.Pool({ connectionString: required('CMS_DATABASE_URL'), max: 1 });
const files = createFilesystemBucket(required('FILES_DIR'));
const variants = Object.keys(IMAGE_VARIANTS);
const delayRaw = Number(process.env.IMAGE_WORKER_DELAY_MS || 1_000);
const interAssetDelay = Number.isFinite(delayRaw) ? Math.max(0, Math.floor(delayRaw)) : 1_000;
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stopping = true; });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const now = () => new Date().toISOString();

function retryableStatus(status, updatedAt) {
  if (!status) return true;
  if (status === 'ready') return false;
  const then = Date.parse(updatedAt || '');
  return !Number.isFinite(then) || Date.now() - then > 15 * 60 * 1000;
}

async function candidate() {
  const result = await db.query(
    `SELECT a.id,a.mime,
       COALESCE(json_agg(json_build_object('variant',v.variant,'status',v.status,'updatedAt',v.updated_at))
         FILTER (WHERE v.variant IS NOT NULL), '[]') AS variants
       FROM assets a LEFT JOIN asset_variants v ON v.asset_id=a.id
       WHERE a.mime IN ('image/jpeg','image/png','image/webp')
       GROUP BY a.id,a.mime,a.created_at
       ORDER BY a.created_at,a.id`,
  );
  return result.rows.find((row) => {
    const byName = new Map(row.variants.map((entry) => [entry.variant, entry]));
    return variants.some((variant) => retryableStatus(byName.get(variant)?.status, byName.get(variant)?.updatedAt));
  }) || null;
}

async function withClaim(asset, work) {
  const client = await db.connect();
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS claimed', [asset.id]);
    if (!lock.rows[0].claimed) return false;
    try { await work(client); } finally { await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [asset.id]); }
    return true;
  } finally { client.release(); }
}

async function writeStatus(client, assetId, variant, row) {
  await client.query(
    `INSERT INTO asset_variants(asset_id,variant,object_key,width,height,size,status,error,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(asset_id,variant) DO UPDATE SET object_key=excluded.object_key,width=excluded.width,height=excluded.height,size=excluded.size,status=excluded.status,error=excluded.error,updated_at=excluded.updated_at`,
    [assetId, variant, row.objectKey, row.width, row.height, row.size, row.status, row.error || '', now()],
  );
}

async function processAsset(asset, client) {
  const source = await files.get(asset.id);
  if (!source) throw Error('original missing');
  const bytes = Buffer.from(await source.arrayBuffer());
  const current = await client.query('SELECT variant,status,updated_at FROM asset_variants WHERE asset_id=$1', [asset.id]);
  const statusByVariant = new Map(current.rows.map((row) => [row.variant, row]));
  for (const [variant, spec] of Object.entries(IMAGE_VARIANTS)) {
    const prior = statusByVariant.get(variant);
    if (!retryableStatus(prior?.status, prior?.updated_at)) continue;
    const key = imageVariantKey(asset.id, variant);
    await writeStatus(client, asset.id, variant, { objectKey: key, width: 1, height: 1, size: 0, status: 'processing' });
    try {
      const output = await sharp(bytes, { failOn: 'none', limitInputPixels: 80_000_000 })
        .rotate()
        .resize({ width: spec.width, withoutEnlargement: true })
        .webp({ quality: spec.quality, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      await files.put(key, output.data, {
        httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
      });
      await writeStatus(client, asset.id, variant, {
        objectKey: key, width: output.info.width, height: output.info.height, size: output.info.size, status: 'ready',
      });
    } catch (error) {
      await writeStatus(client, asset.id, variant, {
        objectKey: key, width: 1, height: 1, size: 0, status: 'failed', error: String(error.message || error).slice(0, 300),
      });
      throw error;
    }
  }
}

async function run() {
  do {
    const asset = await candidate();
    if (!asset) {
      if (!loop || stopping) return;
      await sleep(5_000);
      continue;
    }
    try {
      const claimed = await withClaim(asset, (client) => processAsset(asset, client));
      if (claimed) {
        console.log(`processed ${asset.id}`);
        if (loop && interAssetDelay) await sleep(interAssetDelay);
      }
    } catch (error) {
      console.error(`image derivative failed for ${asset.id}: ${error.message}`);
      if (once) throw error;
    }
  } while (!stopping && (loop || !once));
}

run().finally(() => db.end());
