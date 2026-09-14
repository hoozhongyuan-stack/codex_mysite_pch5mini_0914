import {
  database,
  limited,
  csrf,
  HttpError,
  boundedResponse,
  fail,
} from './server';
import { normalizeEvent } from './behavior-domain.mjs';
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (v) => v.toString(16).padStart(2, '0'),
  ).join('');
export async function ingestBehavior(
  request: Request,
  channel: 'website' | 'mini',
) {
  try {
    if (channel === 'website') csrf(request);
    else if (request.headers.has('origin'))
      throw new HttpError(403, '请求来源不匹配');
    if (!request.headers.get('content-type')?.includes('application/json'))
      throw new HttpError(415, '需要JSON请求');
    if (
      /bot|spider|crawler|headless/i.test(
        request.headers.get('user-agent') || '',
      )
    )
      return new Response(null, { status: 204 });
    let event;
    try {
      event = normalizeEvent(
        JSON.parse(await boundedResponse(request, 4096).text()),
        channel,
      );
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '行为事件无效');
    }
    await limited(
      'behavior-ip:' +
        channel +
        ':' +
        (request.headers.get('cf-connecting-ip') ||
          request.headers.get('x-real-ip') ||
          'local'),
      600,
    );
    await limited('behavior-visitor:' + channel + ':' + event.visitorId, 90);
    const db = database(),
      now = new Date().toISOString();
    const visitor = await hash(channel + ':' + event.visitorId),
      session = await hash(
        channel + ':' + event.visitorId + ':' + event.sessionId,
      );
    await db
      .prepare(
        'INSERT INTO behavior_metadata(id,started_at) VALUES(?,?) ON CONFLICT(id) DO NOTHING',
      )
      .bind('collection', now)
      .run();
    await db
      .prepare(
        'INSERT INTO behavior_events(id,channel,visitor_hash,session_hash,event,path,target,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
      )
      .bind(
        await hash(channel + ':' + event.visitorId + ':' + event.id),
        channel,
        visitor,
        session,
        event.event,
        event.path,
        event.target,
        now,
      )
      .run();
    // Only the dedicated anonymous event table is subject to rolling retention.
    await db
      .prepare('DELETE FROM behavior_events WHERE created_at<?')
      .bind(new Date(Date.now() - 90 * 86400000).toISOString())
      .run();
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return fail(e);
  }
}
