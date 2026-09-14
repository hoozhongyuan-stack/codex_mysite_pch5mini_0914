import { notFound } from 'next/navigation';
import { siteSettings, published } from '@/lib/server';
import { publicExtras, navLinks } from '@/lib/public-cms';
import { PublicShell } from '@/lib/public-view';
import Account from '@/app/account-client';
import { accountLanguageHref } from '@/lib/shop-navigation.mjs';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Account · 用户账号',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ returnTo?: string | string[]; section?: string; order?: string }>;
}) {
  const { lang } = await params;
  if (!['zh', 'en'].includes(lang)) notFound();
  const settings = await siteSettings(),
    extra = await publicExtras();
  return (
    <PublicShell
      lang={lang}
      settings={settings}
      theme={settings.theme}
      path={['account']}
      languageHref={accountLanguageHref(lang === 'en' ? 'zh' : 'en', (await searchParams).returnTo)}
      policies={extra.policies}
      links={navLinks(extra, await published(), lang)}
    >
      <Account key={lang+JSON.stringify([(await searchParams).section,(await searchParams).order])} en={lang === 'en'} policies={extra.policies} />
    </PublicShell>
  );
}
