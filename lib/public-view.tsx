
import Link from '../components/site-link';
import FloatingEntries from '@/app/floating-entries';
import RedemptionOptions from '@/app/redemption-options';
import ContentInteractions from '@/app/content-interactions';
import VisitorMenu from '@/app/visitor-menu';
import ProductOptions, { ProductProvider } from '@/app/product-options';
import { publicTrade, priceLabel } from './product-options.mjs';
import ProductGallery from '@/app/product-gallery';
import Footer from './footer-view';
import {
  ShoppingCart,
  ClipboardList,
  ArrowUpRight,
  Globe2,
  Sparkles,
  FileText,
  Package,
} from 'lucide-react';
import { RichView } from './rich-view';
import { PublicForm, ObserveVisit } from '@/app/public-client';
export function localized(record: any, en: boolean, key: string) {
  return record[key + (en ? 'En' : 'Zh')] || '';
}
export function Media({
  record,
  en = false,
  preview = false,
}: {
  record: any;
  en?: boolean;
  preview?: boolean;
}) {
  return record.imageMime?.startsWith('video') ? (
    <video
      className="record-image"
      controls={!preview}
      preload="metadata"
      src={`/api/media/${record.imageId}`}
      aria-label={localized(record, en, 'title')}
    />
  ) : record.imageId ? (
    <img
      className="record-image"
      src={`/api/media/${record.imageId}`}
      alt={localized(record, en, 'title')}
      loading="lazy"
    />
  ) : null;
}
export function PublicShell({
  lang,
  settings,
  theme,
  path,
  children,
  links = [],
  policies = [],
  languageHref,
}: {
  lang: string;
  settings: any;
  theme: string;
  path: string[];
  children: React.ReactNode;
  links?: any[];
  policies?: any[];
  languageHref?: string;
}) {
  const en = lang === 'en';
  return (
    <div lang={lang} className={`public-site public-${theme}`}>
      <ObserveVisit />
      <header className="public-nav">
        <Link prefetch={false} className="public-brand" href={`/${lang}`}>
          {settings.brand?.logoId && (
            <img
              className="site-brand-logo"
              src={'/api/media/' + settings.brand.logoId}
              alt={localized(settings, en, 'name')}
            />
          )}
          {(!settings.brand?.logoId || settings.brand?.showName) &&
            localized(settings, en, 'name')}
        </Link>
        <nav aria-label={en ? 'Main navigation' : '主导航'}>
          {links.length ? (
            links.map((n: any) => (
              <Link prefetch={false} key={n.id} href={n.href}>
                {en ? n.labelEn : n.labelZh}
              </Link>
            ))
          ) : (
            <>
              {' '}
              <Link prefetch={false} href={`/${lang}/articles`}>{en ? 'Journal' : '观点与洞察'}</Link>
              <Link prefetch={false} href={`/${lang}/products`}>{en ? 'Products' : '产品展示'}</Link>
              <Link prefetch={false} href={`/${lang}/contact`}>
                {en ? 'Get in touch' : '联系我们'}
              </Link>
            </>
          )}
        </nav>
        <div className="public-nav-actions">
          <Link prefetch={false}
            className="commerce-nav-link"
            aria-label={en ? 'Cart' : '购物车'}
            href={`/${lang}/cart`}
          >
            <ShoppingCart size={17} />
            <span>{en ? 'Cart' : '购物车'}</span>
          </Link>

          <VisitorMenu lang={lang} />
          <Link prefetch={false}
            className="language-switch"
            href={
              languageHref ||
              `/${en ? 'zh' : 'en'}${path.length ? '/' + path.join('/') : ''}`
            }
            aria-label={en ? '切换到中文' : 'Switch to English'}
          >
            <Globe2 size={16} />
            {en ? '中文' : 'English'}
          </Link>
        </div>
      </header>
      {children}
      <FloatingEntries lang={lang} />
      <Footer
        settings={settings}
        lang={lang}
        links={links}
        policies={policies}
      />
    </div>
  );
}
export function ContentCards({
  items,
  en,
  lang,
  kind,
}: {
  items: any[];
  en: boolean;
  lang: string;
  kind: string;
}) {
  return items.length ? (
    <div className="public-cards">
      {items.map((r: any, i: number) => (
        <Link prefetch={false}
          href={`/${lang}/${kind}/${r.slug}`}
          key={r.id}
          className="public-card"
        >
          {r.imageId ? (
            <Media record={r} en={en} preview />
          ) : (
            <div className="card-label">
              <span>{kind === 'articles' ? 'JOURNAL' : 'COLLECTION'}</span>
              <b>{String(i + 1).padStart(2, '0')}</b>
            </div>
          )}
          <div className="card-text">
            <span className="eyebrow">
              {r.category ||
                (en
                  ? kind === 'articles'
                    ? 'Perspectives'
                    : 'Product'
                  : kind === 'articles'
                    ? '品牌观点'
                    : '精选产品')}
            </span>
            <h3>
              {localized(r, en, 'title')}
              <ArrowUpRight size={21} />
            </h3>
            <p>{localized(r, en, 'summary')}</p>
            {kind === 'products' && r.trade && (
              <strong className="catalog-price">
                {priceLabel(r.trade, '', en)}
              </strong>
            )}
          </div>
        </Link>
      ))}
    </div>
  ) : (
    <div className="public-empty">
      {kind === 'articles' ? <FileText size={28} /> : <Package size={28} />}
      <h3>
        {en
          ? 'Something worth discovering is on its way.'
          : '值得发现的内容，正在准备中。'}
      </h3>
      <p>
        {en
          ? 'Come back soon for our latest updates.'
          : '我们正在整理新的内容，欢迎稍后回来看看。'}
      </p>
    </div>
  );
}
export function PublicHome({
  settings,
  articles,
  products,
  lang,
}: {
  settings: any;
  articles: any[];
  products: any[];
  lang: string;
}) {
  const en = lang === 'en';
  return (
    <main>
      <section className="public-hero">
        <div className="hero-main">
          <p className="eyebrow">
            {en ? 'A SPACE FOR IDEAS & DISCOVERY' : '观点 / 产品 / 新的可能'}
          </p>
          <h1>{localized(settings, en, 'hero')}</h1>
          <p className="hero-description">
            {localized(settings, en, 'description')}
          </p>
          <Link prefetch={false} className="public-button" href={`/${lang}/articles`}>
            {en ? 'Explore our journal' : '探索品牌观点'}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="hero-aside">
          <span className="hero-index">01 — 03</span>
          <div>
            <p>{en ? 'Discover our perspective' : '从一个好问题开始'}</p>
            <Link prefetch={false} href={`/${lang}/articles`}>
              {en ? 'Ideas, made clear.' : '把经验，变成答案。'}
              <ArrowUpRight size={24} />
            </Link>
          </div>
          <div className="hero-bottom">
            {en
              ? 'Built on curiosity. Shared with purpose.'
              : '源于好奇，专注价值。'}
          </div>
        </div>
      </section>
      <section className="public-section">
        <div className="public-section-heading">
          <div>
            <p className="eyebrow">JOURNAL</p>
            <h2>{en ? 'A fresh perspective.' : '观点，值得分享。'}</h2>
          </div>
          <Link prefetch={false} href={`/${lang}/articles`}>{en ? 'All stories' : '全部文章'} ↗</Link>
        </div>
        <ContentCards
          items={articles.slice(0, 3)}
          en={en}
          lang={lang}
          kind="articles"
        />
      </section>
      <section className="public-section products-section">
        <div className="public-section-heading">
          <div>
            <p className="eyebrow">COLLECTION</p>
            <h2>{en ? 'Made with intention.' : '产品，回应需求。'}</h2>
          </div>
          <Link prefetch={false} href={`/${lang}/products`}>
            {en ? 'View collection' : '查看产品'} ↗
          </Link>
        </div>
        <ContentCards
          items={products.slice(0, 3)}
          en={en}
          lang={lang}
          kind="products"
        />
      </section>
    </main>
  );
}
export function Detail({
  record,
  lang,
  kind,
  category,
  related = [],
  linkedForm,
  privacyVersion,
  redemption = false,
}: {
  redemption?: boolean;
  record: any;
  lang: string;
  kind: string;
  category?: any;
  related?: any[];
  linkedForm?: any;
  privacyVersion?: number;
}) {
  const en = lang === 'en',
    product = kind === 'products';
  const body = localized(record, en, 'body');
  const date = new Date(record.updatedAt);
  const categoryName = category
    ? en
      ? category.nameEn
      : category.nameZh
    : record.category;
  const content = record[en ? 'richEn' : 'richZh'] ? (
    <RichView doc={record[en ? 'richEn' : 'richZh']} />
  ) : (
    body
      .split(/\n\s*\n/)
      .map((p: string, i: number) =>
        p.startsWith('## ') ? (
          <h2 key={i}>{p.slice(3)}</h2>
        ) : (
          <p key={i}>{p}</p>
        ),
      )
  );
  return (
    <ProductProvider
      key={record.id + record.updatedAt}
      trade={product ? publicTrade(record.trade) : null}
      version={record.updatedAt}
      productId={record.id}
    >
      <main
        className={`public-detail detail-v2 ${product ? 'product-detail' : 'article-detail'}`}
      >
        <nav
          className="detail-breadcrumb"
          aria-label={en ? 'Breadcrumb' : '面包屑导航'}
        >
          <Link prefetch={false} href={`/${lang}`}>{en ? 'Home' : '首页'}</Link>
          <span>/</span>
          <Link prefetch={false} href={`/${lang}/${redemption ? 'points-shop' : kind}`}>
            {redemption ? (en ? 'Points shop' : '积分商城') : product ? (en ? 'Products' : '商品展示') : en ? 'Journal' : '文章'}
          </Link>
          {category && !redemption && (
            <>
              <span>/</span>
              <Link prefetch={false} href={`/${lang}/categories/${category.id}`}>{categoryName}</Link>
            </>
          )}
        </nav>
        <div className="detail-hero">
          {product && (
            <div className="product-visual">
              {record.imageId ? (
                <ProductGallery
                  ids={
                    record.imageIds?.length ? record.imageIds : [record.imageId]
                  }
                  title={localized(record, en, 'title')}
                  en={en}
                />
              ) : (
                <Package
                  size={64}
                  strokeWidth={1}
                  aria-label={en ? 'Product' : '商品'}
                />
              )}
            </div>
          )}
          <header className="detail-heading">
            <p className="eyebrow">
              {categoryName || (product ? 'COLLECTION' : 'JOURNAL')}
            </p>
            <h1>{localized(record, en, 'title')}</h1>
            <p className="detail-summary">{localized(record, en, 'summary')}</p>
            <div className="detail-meta">
              {product && record.spu && <span>SPU: {record.spu}</span>}
              {record.author && <span>{record.author}</span>}
              {!product && (
                <>
                  <time dateTime={date.toISOString()}>
                    {date.toLocaleDateString(en ? 'en-US' : 'zh-CN')}
                  </time>
                  <span>
                    {en
                      ? `${Math.max(1, Math.ceil(body.length / (en ? 1100 : 450)))} min read`
                      : `约 ${Math.max(1, Math.ceil(body.length / 450))} 分钟阅读`}
                  </span>
                </>
              )}
            </div>
            {product && <>{redemption ? <RedemptionOptions en={en} slug={record.slug} /> : <ProductOptions en={en} />}<ContentInteractions kind="product" id={record.id} en={en} /></>}
          </header>
        </div>
        {!product && record.imageId && (
          <div className="article-cover">
            <Media record={record} en={en} />
          </div>
        )}
        <div className="detail-reading">
          {product && (
            <div className="detail-section-title" id="product-description">
              <p className="eyebrow">PRODUCT DETAILS</p>
              <h2>{en ? 'Product details' : '商品详情'}</h2>
            </div>
          )}
          <article>{content}</article>
          {!product && <ContentInteractions kind="article" id={record.id} en={en} />}
          {record.sourceUrl && (
            <Link prefetch={false}
              className="detail-source"
              href={record.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {en ? 'Reference source' : '参考来源'} ↗
            </Link>
          )}
          <div className="detail-end">
            <Link prefetch={false} href={`/${lang}/${kind}`}>
              ← {en ? 'Back to collection' : '返回列表'}
            </Link>
            <Link prefetch={false} href={`/${lang}/contact`}>
              {en ? 'Start a conversation' : '与我们交流'} ↗
            </Link>
          </div>
        </div>
        {linkedForm && (
          <section className="detail-attached-form" id="product-inquiry-form">
            <h2>{localized(linkedForm, en, 'title')}</h2>
            <p>{localized(linkedForm, en, 'summary')}</p>
            <PublicForm
              formId={linkedForm.id}
              formVersion={linkedForm.updatedAt}
              fields={linkedForm.fields}
              en={en}
              privacyVersion={privacyVersion}
              sourceContentId={record.id}
            />
          </section>
        )}
        {related.length > 0 && (
          <section className="detail-related">
            <div className="public-section-heading">
              <h2>
                {product
                  ? en
                    ? 'You may also like'
                    : '更多商品'
                  : en
                    ? 'Keep exploring'
                    : '继续阅读'}
              </h2>
            </div>
            <ContentCards items={related} en={en} lang={lang} kind={kind} />
          </section>
        )}
      </main>
    </ProductProvider>
  );
}
export function Contact({
  privacyVersion,
  forms,
  selected,
  en,
  settings,
}: {
  privacyVersion?: number;
  forms: any[];
  selected?: any;
  en: boolean;
  settings: any;
}) {
  const form = selected || forms[0];
  return (
    <main className="contact-page">
      <div>
        <p className="eyebrow">GET IN TOUCH</p>
        <h1>
          {form
            ? localized(form, en, 'title')
            : en
              ? 'Let’s start a conversation.'
              : '从一次交流开始。'}
        </h1>
        <p>
          {form
            ? localized(form, en, 'summary')
            : en
              ? 'We would love to hear from you.'
              : '我们期待听见你的想法。'}
        </p>
        {settings.contactEmail && (
          <Link prefetch={false} href={`mailto:${settings.contactEmail}`}>
            {settings.contactEmail} ↗
          </Link>
        )}
      </div>
      <div>
        {form ? (
          <PublicForm
            formId={form.id}
            en={en}
            fields={form.fields}
            formVersion={form.updatedAt}
            privacyVersion={privacyVersion}
          />
        ) : (
          <div className="public-empty">
            <h3>
              {en ? 'Our inquiry form is not open yet.' : '咨询表单暂未开放。'}
            </h3>
            <p>{en ? 'Please check back later.' : '欢迎稍后再来。'}</p>
          </div>
        )}
      </div>
    </main>
  );
}
