import {ArticleRead} from '@/app/behavior-client';
import {contentSchema, categoryDescription} from '@/lib/geo-page-schema.mjs';
import Catalog from '@/lib/catalog-view';
import { publicExtras, navLinks } from '@/lib/public-cms';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import {
  siteSettings,
  published,
  contentBySlug,
  database,
  limited,
  ORIGIN,
} from '@/lib/server';
import { classifyVisit, safeJson } from '@/lib/domain.mjs';
import {
  PublicShell,
  PublicHome,
  ContentCards,
  Detail,
  Contact,
  localized,
} from '@/lib/public-view';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ lang: string; path?: string[] }>;
  searchParams: Promise<Record<string, string>>;
};
async function resolve(params: Props['params']) {
  const { lang, path = [] } = await params;
  if (!['zh', 'en'].includes(lang)) notFound();
  if (
    path.length > 2 ||
    (path.length &&
      ![
        'articles',
        'products',
        'forms',
        'contact',
        'categories',
        'policies',
      ].includes(path[0]))
  )
    notFound();
  if (path[0] === 'contact' && path.length > 1) notFound();
  const kind = path[0];
  const special = ['categories', 'policies'].includes(kind);
  const extras = special ? await publicExtras() : null;
  const record = special
    ? kind === 'categories'
      ? extras!.categories.find((r: any) => r.id === path[1])
      : extras!.policies.find((r: any) => r.kind === path[1])
    : path[1]
      ? await contentBySlug(kind, path[1])
      : null;
  if (special && !record) notFound();
  if (kind === 'categories' && record) {
    record.titleZh = record.nameZh;
    record.titleEn = record.nameEn;
  }
  if (path[1] && !record) notFound();
  return { lang, path, kind, record, en: lang === 'en' };
}
export async function generateMetadata({ params }: Props) {
  const { lang, path, record, en, kind } = await resolve(params);
  const settings = await siteSettings();
  const title = record
    ? localized(record, en, 'title')
    : kind
      ? (
          {
            articles: en ? 'Journal' : '观点与洞察',
            products: en ? 'Products' : '产品展示',
            forms: en ? 'Contact forms' : '咨询表单',
            contact: en ? 'Contact' : '联系我们',
          } as any
        )[kind]
      : localized(settings, en, 'name');
  const description = record
    ? kind === 'categories' ? categoryDescription(record, lang) : localized(record, en, 'summary')
    : localized(settings, en, 'description');
  const suffix = path.length ? '/' + path.join('/') : '';
  return {
    title,
    description,
    alternates: {
      canonical: `${ORIGIN}/${lang}${suffix}`,
      languages: {
        'zh-CN': `${ORIGIN}/zh${suffix}`,
        en: `${ORIGIN}/en${suffix}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${ORIGIN}/${lang}${suffix}`,
      type: record && kind === 'articles' ? 'article' : 'website',
    },
    twitter: { card: 'summary', title, description },
  };
}
export default async function PublicPage({ params, searchParams }: Props) {
  const { lang, path, kind, record, en } = await resolve(params);
  const [settings, all, query, requestHeaders] = await Promise.all([
    siteSettings(),
    published(),
    searchParams,
    headers(),
  ]);
  const visit = classifyVisit(requestHeaders.get('user-agent') || '', '');
  if (visit.kind === 'claimed_bot') {
    try {
      await limited(
        'bot:' + (requestHeaders.get('cf-connecting-ip') || visit.source),
        20,
      );
      await database()
        .prepare(
          'INSERT INTO visits(id,kind,source,path,created_at) VALUES(?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          visit.kind,
          visit.source,
          `/${lang}/${path.join('/')}`,
          new Date().toISOString(),
        )
        .run();
    } catch (e) {
      console.warn(
        'Bot record unavailable',
        e instanceof Error ? e.message : 'unknown',
      );
    }
  }
  const theme = ['tech', 'minimal', 'editorial'].includes(query.theme || '')
    ? query.theme!
    : settings.theme;
  const extra = await publicExtras();
  const forms = all.filter((r: any) => r.kind === 'forms');
  const schema =
    record && ['articles', 'products'].includes(kind)
      ? contentSchema({...record, kind}, lang, `${ORIGIN}/${lang}/${path.join('/')}`, settings)
      : {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: localized(settings, en, 'name'),
          url: `${ORIGIN}/${lang}`,
          inLanguage: lang,
        };
  return (
    <PublicShell
      lang={lang}
      settings={settings}
      theme={theme}
      path={path}
      links={navLinks(extra, all, lang)}
      policies={extra.policies}
      languageHref={`/${en?'zh':'en'}/${path.join('/')}?${new URLSearchParams(query)}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJson(schema) }}
      />
      {kind === 'policies' ? (
        <main className="public-detail">
          <p className="eyebrow">
            {en ? 'POLICY' : '网站政策'} · v{record.version}
          </p>
          <h1>{localized(record, en, 'title')}</h1>
          <article style={{ whiteSpace: 'pre-wrap' }}>
            {localized(record, en, 'body')}
          </article>
        </main>
      ) : kind === 'categories' ? (
        <Catalog all={all} categories={extra.categories} kind={record.kind} query={query} lang={lang} initialCategory={record.id}/>
      ) : !kind ? (
        <PublicHome
          settings={settings}
          articles={all.filter((r: any) => r.kind === 'articles')}
          products={all.filter((r: any) => r.kind === 'products')}
          lang={lang}
        />
      ) : kind === 'contact' || kind === 'forms' ? (
        <Contact
          privacyVersion={
            extra.policies.find((p: any) => p.kind === 'privacy')?.version
          }
          forms={forms}
          selected={record}
          en={en}
          settings={settings}
        />
      ) : record ? (
        <Detail
          redemption={kind === 'products' && query.purchase === 'points'}
          linkedForm={forms.find((f: any) => f.id === record.linkedFormId)}
          privacyVersion={
            extra.policies.find((p: any) => p.kind === 'privacy')?.version
          }
          record={record}
          lang={lang}
          kind={kind}
          category={extra.categories.find(
            (c: any) => c.id === record.categoryId,
          )}
          related={all
            .filter((r: any) => r.kind === kind && r.id !== record.id)
            .sort(
              (a: any, b: any) =>
                Number(b.categoryId === record.categoryId) -
                Number(a.categoryId === record.categoryId),
            )
            .slice(0, 3)}
        />
      ) : (
        <Catalog all={all} categories={extra.categories} kind={kind} query={query} lang={lang}/>
      )}
      {record&&kind==='articles'&&<ArticleRead id={record.id}/>}
    </PublicShell>
  );
}
