import {displayVideoBody} from '@/lib/video-body.mjs';
import {env} from 'cloudflare:workers';
import {identity} from '@/lib/identity';
import {miniBuyer} from '@/lib/mini-auth';
import {database,fail,HttpError,jsonBody,limited} from '@/lib/server';
import {mediaAction,mediaFile,sealPlayback,openPlayback} from '@/lib/mini-media.mjs';
import {miniRichNodes} from '@/lib/mini-content.mjs';
import {uploadForm} from '@/app/api/form-upload/route';
const json=(data:any)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
async function session(request:Request,required=false){if(required||request.headers.has('authorization'))return (await miniBuyer(request)).session;return '';}
function action(kind:string,a:string,write=false){try{return mediaAction(kind,a,write)}catch{throw new HttpError(400,'未知操作')}}
async function stream(request:Request,q:URLSearchParams){
 const e=env as unknown as Record<string,string>;if(!e.IDENTITY_KEY||!e.IDENTITY_URL)throw new HttpError(503,'视频服务未配置');
 let ctx:any,file:string;try{ctx=await openPlayback(q.get('ticket'),e.IDENTITY_KEY);file=mediaFile(q.get('file'))}catch{throw new HttpError(403,'播放授权已过期，请重新播放')}
 const response=await fetch(e.IDENTITY_URL+'/video-file',{method:'POST',headers:{Authorization:'Bearer '+e.IDENTITY_KEY,'Content-Type':'application/json'},body:JSON.stringify({...ctx,file}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new HttpError(403,'视频暂时无法播放');
 const headers={'Content-Type':file==='index.m3u8'?'application/vnd.apple.mpegurl':file==='enc.key'?'application/octet-stream':'video/mp2t','Cache-Control':'private,no-store','Referrer-Policy':'no-referrer'};
 if(file!=='index.m3u8')return new Response(response.body,{headers});
 const prefix='/api/mini/media?kind=videos&action=stream&ticket='+encodeURIComponent(q.get('ticket')||'')+'&file=';
 const body=(await response.text()).replace(/\/api\/video\/stream\?token=[\w-]+&file=(index\.m3u8|enc\.key|segment[0-9]{5,}\.ts)/g,(_,name)=>prefix+name);
 return new Response(body,{headers});
}
export async function GET(request:Request){try{
 const q=new URL(request.url).searchParams,kind=q.get('kind')||'',a=q.get('action')||'list';
 if(kind==='videos'&&a==='stream')return await stream(request,q);
 action(kind,a);const s=await session(request,['mine','registration','state'].includes(a));
 const data={id:q.get('id')||'',q:(q.get('q')||'').slice(0,100),type:q.get('type')||'',page:Math.max(1,Math.min(10000,Number(q.get('page'))||1)),session:s};
 if(a==='state')return json(await identity('points-state',{session:s,kind:kind==='videos'?'video':'salon',id:data.id}));
 const result=await identity((kind==='videos'?'video-':'marketing-')+a,data);
 if(result.series)result.series={...result.series,nodes:miniRichNodes(displayVideoBody(result.series.bodyZh))};
 if(result.event)result.event={...result.event,nodes:miniRichNodes(result.event.bodyZh)};
 return json(result);
}catch(e){return fail(e)}}
export async function POST(request:Request){try{
 const q=new URL(request.url).searchParams,kind=q.get('kind')||'',a=q.get('action')||'';
 if(kind==='salons'&&a==='upload'){const buyer=await miniBuyer(request);return uploadForm(request,buyer)}
 action(kind,a,true);const s=await session(request,kind==='salons'||a==='interact');
 await limited('mini-media:'+s+':'+(request.headers.get('cf-connecting-ip')||'guest'),100);
 const data=await jsonBody(request);const prefix=kind==='videos'?'video-':'marketing-';
 if(a==='interact'){
  if(!['like','favorite','share'].includes(data.action)||typeof data.active!=='boolean')throw new HttpError(400,'互动参数无效');
  const source=await identity(kind==='videos'?'video-detail':'marketing-detail',{id:data.parentId||data.id});
  const target=kind==='videos'?source.episodes.find((item:any)=>item.id===data.id):source.event;
  if(!target)throw new HttpError(404,'内容未开放');
  return json(await identity('points-interact',{session:s,kind:kind==='videos'?'video':'salon',id:data.id,action:data.action,active:data.active,_title:target.titleZh,_path:kind==='videos'?'/zh/videos/'+source.series.id:'/zh/events/'+target.id}));
 }
 if(kind==='videos'){
  const browser=typeof data.browser==='string'&&/^[\w-]{43}$/.test(data.browser)?data.browser:'';if(!browser)throw new HttpError(400,'播放会话无效');
  const result=await identity(prefix+a,{id:data.id,token:data.token,position:data.position,session:s,browser});
  if(a==='authorize'){const e=env as unknown as Record<string,string>;if(!e.IDENTITY_KEY)throw new HttpError(503,'视频服务未配置');result.ticket=await sealPlayback({session:s,browser,token:result.token},e.IDENTITY_KEY)}
  return json(result);
 }
 const event=(await identity('marketing-detail',{id:data.id})).event;
 const files:string[]=[];if(a==='register')for(const f of event.fields.filter((f:any)=>f.type==='image')){const path=data.answers?.[f.id];if(!path)continue;const id=typeof path==='string'&&path.match(/^\/api\/submission-file\/([a-f0-9-]{36})$/)?.[1];const buyer=await miniBuyer(request);if(!id||!(await database().prepare('SELECT id FROM submission_files WHERE id=? AND form_id=? AND field_id=? AND session=?').bind(id,'event:'+data.id,f.id,'mini:'+buyer.user.id).first()))throw new HttpError(400,'报名图片无效');files.push(id)}
 const result=await identity(prefix+a,{id:data.id,session:s,answers:data.answers,consent:data.consent,code:data.code,_eventVersion:event.updated});
 for(const id of files)await database().prepare('UPDATE submission_files SET submission_id=? WHERE id=?').bind('event:'+result.registration.id,id).run();
 return json(result);
}catch(e){return fail(e)}}
