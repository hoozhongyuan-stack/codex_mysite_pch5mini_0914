import {pageMetadata, collectionSchema} from '@/lib/geo-page-schema.mjs';
import {safeJson} from '@/lib/domain.mjs';
import { notFound, redirect } from 'next/navigation';
import { PublicShell } from '@/lib/public-view';
import { publicExtras, navLinks } from '@/lib/public-cms';
import { siteSettings, published, ORIGIN } from '@/lib/server';
import { identity } from '@/lib/identity';
import SalonPublic from '@/app/salon-public';
export const dynamic = 'force-dynamic';
export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; eventPath?: string[] }>;
}) {
  const { lang, eventPath = [] } = await params;
  if (!['zh', 'en'].includes(lang) || eventPath.length > 1) notFound();
  const [settings, extra, all] = await Promise.all([
    siteSettings(),
    publicExtras(),
    published(),
  ]);
  const id = eventPath[0] || '';
  if(id==='mine') redirect(`/${lang}/account?section=events`);
  let event = null,
    error = '';
  if (id && id !== 'mine') {
    try {
      event = (await identity('marketing-detail', { id })).event;
    } catch {
      notFound();
    }
  }
  let initialList:any = null;
  if(!id) { try { initialList = await identity('marketing-list',{page:1}); } catch { error = lang==='en'?'Events temporarily unavailable':'活动暂时无法加载'; } }
  const title = event?.[lang==='en'?'titleEn':'titleZh'] || (lang==='en'?'Salon events':'沙龙活动');
  const url = `${ORIGIN}/${lang}/events${id?'/'+id:''}`;
  const schema = event ? {'@context':'https://schema.org','@type':'Event',name:title,url,inLanguage:lang,description:event[lang==='en'?'summaryEn':'summaryZh'],startDate:event.starts,endDate:event.ends,...(event.organizer?{organizer:{'@type':'Organization',name:event.organizer}}:{}),...(event[lang==='en'?'locationEn':'locationZh']?{location:{'@type':'Place',name:event[lang==='en'?'locationEn':'locationZh'],address:event[lang==='en'?'addressEn':'addressZh']}}:{}),...(event.status==='cancelled'?{eventStatus:'https://schema.org/EventCancelled'}:{})} : collectionSchema(url,title,lang,(initialList?.rows||[]).map((r:any)=>({name:r[lang==='en'?'titleEn':'titleZh'],url:`${ORIGIN}/${lang}/events/${r.id}`})));
  return (
    <PublicShell
      lang={lang}
      settings={settings}
      theme={settings.theme}
      path={['events', ...eventPath]}
      links={navLinks(extra, all, lang)}
      policies={extra.policies}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(schema)}}/>
      <SalonPublic key={lang+id}
        initialList={initialList}
        lang={lang}
        id={id}
        initialEvent={event}
        initialError={error}
      />
    </PublicShell>
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; eventPath?: string[] }>;
}) {
  const { lang, eventPath = [] } = await params;
  if (!eventPath[0] || eventPath[0] === 'mine')
    return {
      ...pageMetadata(ORIGIN,lang,'events',lang==='en'?'Salon events':'沙龙活动',lang==='en'?'Explore salon events, schedules, venues and registration details.':'浏览沙龙活动，了解时间、地点与报名信息。'),
      ...(eventPath[0] === 'mine'
        ? { robots: { index: false, follow: false } }
        : {}),
    };
  try {
    const { event } = await identity('marketing-detail', { id: eventPath[0] });
    return {
      ...pageMetadata(ORIGIN,lang,`events/${eventPath[0]}`,lang==='en'?event.titleEn:event.titleZh,(lang==='en'?event.summaryEn:event.summaryZh) || (lang==='en'?'Event schedule, venue and registration details.':'查看活动时间、地点与报名详情。')),
    };
  } catch {
    return { title: '活动不可用', robots: { index: false, follow: false } };
  }
}
