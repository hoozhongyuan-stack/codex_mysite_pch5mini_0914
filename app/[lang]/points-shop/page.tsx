import {notFound} from 'next/navigation';
import {siteSettings,published,ORIGIN} from '@/lib/server';
import {publicExtras,navLinks} from '@/lib/public-cms';
import {PublicShell} from '@/lib/public-view';
import {pageMetadata,collectionSchema} from '@/lib/geo-page-schema.mjs';
import {safeJson} from '@/lib/domain.mjs';
import {publicPoints} from '@/lib/public-points';
import PointsMall from '@/app/points-mall';
export const dynamic='force-dynamic';
export default async function Page({params}:any){
  const {lang}=await params;
  if(!['zh','en'].includes(lang))notFound();
  const [settings,extra,all,rows]=await Promise.all([siteSettings(),publicExtras(),published(),publicPoints()]);
  const schema=collectionSchema(`${ORIGIN}/${lang}/points-shop`,lang==='en'?'Points shop':'积分商城',lang,rows.map((r:any)=>({name:lang==='en'?r.titleEn:r.titleZh,url:`${ORIGIN}/${lang}/products/${r.slug}`})));
  return <PublicShell lang={lang} settings={settings} theme={settings.theme} path={['points-shop']} policies={extra.policies} links={navLinks(extra,all,lang)}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(schema)}}/>
    <PointsMall en={lang==='en'} initialRows={rows}/>
  </PublicShell>;
}
export async function generateMetadata({params}:any){
  const {lang}=await params;
  return pageMetadata(ORIGIN,lang,'points-shop',lang==='en'?'Points shop':'积分商城',lang==='en'?'Browse rewards and explore products available to redeem with points.':'浏览积分好礼，了解可兑换商品与所需积分。');
}
