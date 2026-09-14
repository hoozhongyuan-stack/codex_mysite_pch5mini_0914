import {publicExtras} from '@/lib/public-cms';
import {published,ORIGIN,fail} from '@/lib/server';
import {identity} from '@/lib/identity';
import {sitemapXml} from '@/lib/geo-health.mjs';
async function publicRows(action:string){
 const rows:any[]=[];
 for(let page=1;page<=100;page++){
  const result=await identity(action,{page});rows.push(...(result.rows||[]));
  if(page>=Number(result.pages||1))return rows;
 }
 throw Error('站点地图内容超过分页上限，需要拆分站点地图');
}
export async function GET(){
 try{
  const [items,extra,videos,events]=await Promise.all([published(),publicExtras(),publicRows('video-list'),publicRows('marketing-list')]);
  const entries=[...['','/articles','/products','/contact','/videos','/events','/points-shop'].map(path=>({path})),...extra.categories.map((c:any)=>({path:'/categories/'+encodeURIComponent(c.id)})),...extra.policies.map((p:any)=>({path:'/policies/'+encodeURIComponent(p.kind)})),...items.map((r:any)=>({path:`/${r.kind}/${encodeURIComponent(r.slug)}`,updated:r.updatedAt})),...videos.map((r:any)=>({path:'/videos/'+encodeURIComponent(r.id),updated:r.updated})),...events.map((r:any)=>({path:'/events/'+encodeURIComponent(r.id),updated:r.updated}))];
  return new Response(sitemapXml(ORIGIN,entries),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300'}});
 }catch(e){return fail(e);}
}
