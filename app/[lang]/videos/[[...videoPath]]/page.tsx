import {pageMetadata, collectionSchema} from '@/lib/geo-page-schema.mjs';
import {safeJson} from '@/lib/domain.mjs';
import { notFound, redirect } from 'next/navigation';
import { PublicShell } from '@/lib/public-view';
import { publicExtras, navLinks } from '@/lib/public-cms';
import { siteSettings, published, ORIGIN } from '@/lib/server';
import { identity } from '@/lib/identity';
import VideoPublic from '@/app/video-public';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: any) {
  const { lang, videoPath = [] } = await params;
  if (!['zh', 'en'].includes(lang) || videoPath.length > 1) notFound();
  const [settings, extra, all] = await Promise.all([
    siteSettings(),
    publicExtras(),
    published(),
  ]);
  const id = videoPath[0] || '';
  if(id==='mine') redirect(`/${lang}/account?section=watching`);
  let initial = null;
  if (id && id !== 'mine') {
    try {
      initial = await identity('video-detail', { id });
    } catch {
      notFound();
    }
  } else if (!id) {
    try {
      initial = await identity('video-list');
    } catch {
      initial = { rows: [] };
    }
  }
  const name = initial?.series?.[lang === 'en' ? 'titleEn' : 'titleZh'] || (lang === 'en' ? 'Video series' : '视频专栏');
  const url = `${ORIGIN}/${lang}/videos${id ? '/'+id : ''}`;
  const schema = id ? {'@context':'https://schema.org','@type':'CreativeWorkSeries',name,url,inLanguage:lang,description:initial?.series?.[lang==='en'?'summaryEn':'summaryZh']} : collectionSchema(url,name,lang,(initial?.rows || []).map((r:any)=>({name:r[lang==='en'?'titleEn':'titleZh'],url:`${ORIGIN}/${lang}/videos/${r.id}`})));
  return (
    <PublicShell
      lang={lang}
      settings={settings}
      theme={settings.theme}
      path={['videos', ...videoPath]}
      links={navLinks(extra, all, lang)}
      policies={extra.policies}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJson(schema)}}/>
      <VideoPublic key={lang+id} lang={lang} id={id} initial={initial} />
    </PublicShell>
  );
}
export async function generateMetadata({ params }: any) {
  const { lang, videoPath = [] } = await params;
  const en = lang === 'en';
  if (!videoPath[0] || videoPath[0] === 'mine')
    return {
      ...pageMetadata(ORIGIN,lang,'videos',en ? 'Video series' : '视频专栏',en ? 'Explore video series, courses and episodes.' : '浏览视频系列、课程与分集内容。'),
      ...(videoPath[0] === 'mine'
        ? { robots: { index: false, follow: false } }
        : {}),
    };
  try {
    const { series } = await identity('video-detail', { id: videoPath[0] });
    return {
      ...pageMetadata(ORIGIN,lang,`videos/${videoPath[0]}`,series[en ? 'titleEn' : 'titleZh'],series[en ? 'summaryEn' : 'summaryZh'] || (en?'Explore this video series and its episodes.':'查看视频系列介绍与分集内容。')),
    };
  } catch {
    return { title: 'Video unavailable', robots: { index: false } };
  }
}
