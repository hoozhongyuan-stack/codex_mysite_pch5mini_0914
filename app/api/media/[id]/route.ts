import {channelState} from '@/lib/channel-store';
import {channelAssetIds} from '@/lib/channel-config.mjs';
import {brandAssetIds} from '@/lib/brand-domain.mjs';
import { identity } from '@/lib/identity';
import { footerAssetIds } from '@/lib/footer-domain.mjs';
import { imageVariant } from '@/lib/image-variant-domain.mjs';
import { env } from 'cloudflare:workers';
import { admin, database, fail, HttpError, siteSettings } from '@/lib/server';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const variant = imageVariant(new URL(request.url).searchParams.get('variant') || '');
    if (
      !(await database()
        .prepare('SELECT id FROM assets WHERE id=?')
        .bind(id)
        .first())
    )
      throw new HttpError(404, '素材不存在');
    const publicUse = await database()
      .prepare(
        "SELECT id FROM contents WHERE status='published' AND (json_extract(data,'$.imageId')=? OR id IN (SELECT content_id FROM content_assets WHERE asset_id=?)) LIMIT 1",
      )
      .bind(id, id)
      .first();
    const footerUse =
      !publicUse && [...footerAssetIds((await siteSettings()).footer),...brandAssetIds((await siteSettings()).brand)].includes(id);
    let eventUse=false;
    if(!publicUse&&!footerUse&&await database().prepare('SELECT id FROM marketing_assets WHERE asset_id=? LIMIT 1').bind(id).first()){
      try{eventUse=(await identity('marketing-asset-public',{assetId:id})).allowed || (await identity('video-asset-public',{assetId:id})).allowed}catch{}
    }
    const published=(await channelState()).published;
    const channelUse=published&&channelAssetIds(published.mini,published.floating||[]).includes(id);
    if (!publicUse && !footerUse && !eventUse && !channelUse) await admin('readAssets');
    let objectKey = id;
    if (variant) {
      try {
        const row = await database().prepare(
          "SELECT object_key FROM asset_variants WHERE asset_id=? AND variant=? AND status='ready'",
        ).bind(id, variant).first<any>();
        if (row?.object_key) objectKey = row.object_key;
      } catch (error) {
        // During a rolling release an old database can briefly serve new clients.
        // Keep the original available until the additive migration has completed.
        if (!/asset_variants|no such table|does not exist/i.test(String(error))) throw error;
      }
    }
    const object = await env.FILES?.get(objectKey);
    if (!object) throw new HttpError(404, '素材不存在');
    const headers = new Headers({
      'Content-Type':
        object.httpMetadata?.contentType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': publicUse || footerUse || eventUse || channelUse ? 'public, max-age=31536000, immutable' : 'private, no-cache',
      'Content-Security-Policy': "default-src 'none'",
    });
    return new Response(object.body, { headers });
  } catch (e) {
    return fail(e);
  }
}
