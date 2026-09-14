import type { Metadata } from 'next';
import {siteSettings} from '@/lib/server';
import './globals.css';
import './interaction.css';
import { headers } from 'next/headers';
export async function generateMetadata(): Promise<Metadata> {
 const settings=await siteSettings();
 return {
  title: 'GEO Studio · 内容与发现',
  description: '多语言品牌内容、产品与 GEO 可发现性管理。',
  ...(settings.brand?.faviconId ? {icons:{icon:'/api/media/'+settings.brand.faviconId,apple:'/api/media/'+settings.brand.faviconId}} : {}),
 };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = (await headers()).get('x-site-lang') === 'en' ? 'en' : 'zh-CN';
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
