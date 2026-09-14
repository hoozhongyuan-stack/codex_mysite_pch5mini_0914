import { identity } from '@/lib/identity';
import { miniBuyer } from '@/lib/mini-auth';
import { database, fail, HttpError, jsonBody, limited } from '@/lib/server';
import { interactionInput } from '@/lib/mini-content.mjs';
async function target(kind: string, id: string) {
  if (!['article', 'product'].includes(kind) || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new HttpError(400, '互动参数无效');
  const row = await database().prepare("SELECT data,slug FROM contents WHERE id=? AND kind=? AND status='published' AND json_extract(data,'$.channels.mini')=1")
    .bind(id, kind === 'article' ? 'articles' : 'products').first<any>();
  if (!row) throw new HttpError(404, '内容未开放');
  return row;
}
const json = (data: any) => Response.json(data, {headers: {'Cache-Control':'no-store'}});
export async function GET(request: Request) {
  try {
    const q=new URL(request.url).searchParams, kind=q.get('kind')||'', id=q.get('id')||'';
    await target(kind,id);
    const {session}=await miniBuyer(request);
    return json(await identity('points-state',{session,kind,id}));
  } catch(e) { return fail(e); }
}
export async function POST(request: Request) {
  try {
    const {session}=await miniBuyer(request);
    await limited('mini-interact:'+session,100);
    let input;
    try { input=interactionInput(await jsonBody(request)); } catch { throw new HttpError(400,'互动参数无效'); }
    const row=await target(input.kind,input.id);
    return json(await identity('points-interact',{...input,session,_title:JSON.parse(row.data).titleZh||'',_path:'/zh/'+(input.kind==='article'?'articles':'products')+'/'+row.slug}));
  } catch(e) { return fail(e); }
}
