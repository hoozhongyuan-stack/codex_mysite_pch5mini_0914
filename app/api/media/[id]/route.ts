import {channelState} from '@/lib/channel-store';
import {channelAssetIds} from '@/lib/channel-config.mjs';
import {brandAssetIds} from '@/lib/brand-domain.mjs';
import { identity } from '@/lib/identity';
import { footerAssetIds } from '@/lib/footer-domain.mjs';
import { env } from 'cloudflare:workers';
import { admin, database, fail, HttpError, siteSettings } from '@/lib/server';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
    const object = await env.FILES?.get(id);
    if (!object) throw new HttpError(404, '素材不存在');
    const headers = new Headers({
      'Content-Type':
        object.httpMetadata?.contentType || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-cache',
      'Content-Security-Policy': "default-src 'none'",
    });
    return new Response(object.body, { headers });
  } catch (e) {
    return fail(e);
  }
}
