import { marketingAccess } from '@/lib/marketing-access';
import { env } from 'cloudflare:workers';
import { admin, database, HttpError, fail } from '@/lib/server';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const record = await database()
      .prepare(
        'SELECT mime,submission_id FROM submission_files WHERE id=? AND submission_id IS NOT NULL',
      )
      .bind(id)
      .first<any>();
    if (!record) throw new HttpError(404, '文件不存在');
    if(record.submission_id.startsWith('event:')) await marketingAccess();
    else await admin('readSubmissions');
    const object = await env.FILES?.get('form/' + id);
    if (!object) throw new HttpError(404, '文件不存在');
    return new Response(object.body, {
      headers: {
        'Content-Type': record.mime,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
