import {publicPoints} from '@/lib/public-points';
import { database, admin, csrf, fail, jsonBody, limited, HttpError } from '@/lib/server';
import { buyer } from '@/lib/orders';
import { createRedemption, cancelRedemption, settleRedemption } from '@/lib/redemption';
export async function GET(request:Request,{params}:any) {
  try {
    const {action}=await params;
    if(action!=='list') throw new HttpError(404,'未知操作');
    const q=new URL(request.url).searchParams.get('q') || '';
    return Response.json({rows:await publicPoints(q)},{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return fail(e instanceof HttpError ? e : new HttpError(400,e instanceof Error && !/D1_|SQLITE|constraint|FOREIGN KEY|NOT NULL/i.test(e.message) ? e.message : '商品库存或兑换配额已变化，请刷新后重试'));}
}
export async function POST(request:Request,{params}:any) {
  try {
    csrf(request); const {action}=await params;
    if(action==='recover') {
      const owner=await admin('saveSettings'); await limited('mall-recover:'+owner.userId,20);
      const rows=(await database().prepare("SELECT id FROM orders WHERE currency='PTS' AND json_extract(data,'$.redemptionState')='pending' ORDER BY created_at LIMIT 100").all<any>()).results;
      let failed=0; for(const row of rows) {try {await settleRedemption(row.id);} catch {failed++;}}
      return Response.json({count:rows.length-failed,failed});
    }
    const user=await buyer(request); await limited('mall:'+user.id,30); const data=await jsonBody(request);
    if(action==='create') return Response.json(await createRedemption(user,data));
    if(action==='cancel') return Response.json(await cancelRedemption(String(data.id),String(user.id)));
    throw new HttpError(404,'未知操作');
  } catch(e) {return fail(e instanceof HttpError ? e : new HttpError(400,e instanceof Error && !/D1_|SQLITE|constraint|FOREIGN KEY|NOT NULL/i.test(e.message) ? e.message : '商品库存或兑换配额已变化，请刷新后重试'));}
}
