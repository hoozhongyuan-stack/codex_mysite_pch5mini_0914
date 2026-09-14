import SiteLink from '../../../components/site-link';
import { admin, database, siteSettings } from '@/lib/server';
import { Detail } from '@/lib/public-view';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: '内容预览',
  robots: { index: false, follow: false },
};
export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  try {
    await admin('readContent');
  } catch {
    notFound();
  }
  const { id } = await params,
    { lang: requested } = await searchParams,
    lang = requested === 'en' ? 'en' : 'zh';
  const db = database(),
    row = await db
      .prepare('SELECT * FROM contents WHERE id=?')
      .bind(id)
      .first<any>();
  if (!row || !['articles', 'products'].includes(row.kind)) notFound();
  const record = { ...JSON.parse(row.data), updatedAt: row.updated_at };
  const category = record.categoryId
    ? await db
        .prepare('SELECT data FROM categories WHERE id=?')
        .bind(record.categoryId)
        .first<any>()
    : null;
  const settings = await siteSettings();
  return (
    <div className={'public-site public-' + settings.theme}>
      <div className="list-batch">
        <b>
          管理员预览 · {row.status === 'draft' ? '草稿尚未发布' : '已发布内容'}
        </b>
        <SiteLink className="btn" href={`/?view=${row.kind}`}>
          返回管理
        </SiteLink>
        <SiteLink
          className="btn"
          href={`/preview/${id}?lang=${lang === 'zh' ? 'en' : 'zh'}`}
        >
          {lang === 'zh' ? 'English' : '中文'}
        </SiteLink>
      </div>
      <Detail
        record={record}
        lang={lang}
        kind={row.kind}
        category={category ? JSON.parse(category.data) : undefined}
      />
    </div>
  );
}
