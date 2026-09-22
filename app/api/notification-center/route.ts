import { admin, fail } from '@/lib/server';
import { notificationRecords } from '@/lib/notification-center.mjs';

export async function GET() {
  try {
    await admin('manageConfiguration');
    return Response.json(
      { records: await notificationRecords(80) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
