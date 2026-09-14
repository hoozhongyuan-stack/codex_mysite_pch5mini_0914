import {
  csrf,
  database,
  fail,
  jsonBody,
  limited,
  HttpError,
} from '@/lib/server';
import { classifyVisit } from '@/lib/domain.mjs';
export async function POST(request: Request) {
  try {
    csrf(request);
    await limited(
      'ref:' + (request.headers.get('cf-connecting-ip') || 'anonymous'),
      20,
    );
    const input = await jsonBody(request);
    const path = String(input.path || '');
    if (!/^\/(zh|en)(\/|$)/.test(path) || path.length > 300)
      throw new HttpError(400, '无效页面');
    const visit = classifyVisit('', input.referrer);
    if (visit.kind === 'ai_referral')
      await database()
        .prepare(
          'INSERT INTO visits(id,kind,source,path,created_at) VALUES(?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          visit.kind,
          visit.source,
          path,
          new Date().toISOString(),
        )
        .run();
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
