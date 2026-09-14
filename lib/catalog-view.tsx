import CatalogFilters from '@/app/catalog-filters';
import { catalogPage } from './catalog-domain.mjs';
import { ContentCards } from './public-view';
export default function Catalog({
  all,
  categories,
  kind,
  query,
  lang,
  initialCategory = '',
}: any) {
  const en = lang === 'en',
    t = (zh: string, enText: string) => (en ? enText : zh);
  const result = catalogPage(
    all,
    categories,
    kind,
    query,
    lang,
    initialCategory,
  );
  const cats = categories.filter((c: any) => c.kind === kind);
  const href = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query))
      if (typeof v === 'string') p.set(k, v);
    p.set('category', result.category);
    p.set('page', String(page));
    return '?' + p;
  };
  const current = cats.find((c: any) => c.id === result.category);
  const parent = current?.parent_id || current?.id || '';
  const children = cats.filter((c: any) => c.parent_id === parent);
  const categoryHref = (id: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query))
      if (typeof v === 'string' && k !== 'page') p.set(k, v);
    p.set('category', id);
    return `/${lang}/${kind}?${p}`;
  };
  const categoryName = (c: any) => (en ? c.nameEn : c.nameZh);
  return (
    <main className="public-section list-page catalog-page">
      <nav className="catalog-breadcrumb">
        <a href={`/${lang}`}>{t('首页', 'Home')}</a>
        <span>/</span>
        <a href={`/${lang}/${kind}`}>
          {t(
            kind === 'products' ? '商品' : '文章',
            kind === 'products' ? 'Products' : 'Journal',
          )}
        </a>
        {current && (
          <>
            <span>/</span>
            <span>{categoryName(current)}</span>
          </>
        )}
      </nav>
      <div className="public-section-heading">
        <div>
          <h1>
            {current
              ? categoryName(current)
              : t(
                  kind === 'products' ? '全部商品' : '阅读与灵感',
                  kind === 'products' ? 'All products' : 'Journal',
                )}
          </h1>
          <p>
            {t(
              kind === 'products'
                ? '为日常挑选一份喜欢，发现适合你的好物。'
                : '从新的视角，发现值得阅读的故事。',
              kind === 'products'
                ? 'Thoughtful objects for your everyday life.'
                : 'Stories and perspectives worth discovering.',
            )}
          </p>
        </div>
      </div>
      <nav
        className="catalog-categories"
        aria-label={t('一级分类', 'Categories')}
      >
        <a className={!current ? 'selected' : ''} href={categoryHref('')}>
          {t('全部', 'All')}
        </a>
        {cats
          .filter((c: any) => !c.parent_id)
          .map((c: any) => (
            <a
              key={c.id}
              className={parent === c.id ? 'selected' : ''}
              href={categoryHref(c.id)}
            >
              {categoryName(c)}
            </a>
          ))}
      </nav>
      {!!children.length && (
        <nav
          className="catalog-subcategories"
          aria-label={t('二级分类', 'Subcategories')}
        >
          <a
            className={result.category === parent ? 'selected' : ''}
            href={categoryHref(parent)}
          >
            {t('全部', 'All')}
          </a>
          {children.map((c: any) => (
            <a
              key={c.id}
              className={c.id === result.category ? 'selected' : ''}
              href={categoryHref(c.id)}
            >
              {categoryName(c)}
            </a>
          ))}
        </nav>
      )}
      <div className="catalog-tools-row">
        <p className="catalog-count">
          {t(`共 ${result.total} 件`, `${result.total} results`)}
        </p>
        <CatalogFilters en={en}>
          <form method="get" className="catalog-toolbar">
            {query.theme && (
              <input type="hidden" name="theme" value={query.theme} />
            )}
            <input type="hidden" name="category" value={result.category} />
            <label className="catalog-search">
              {t('关键词', 'Search')}
              <input
                name="q"
                defaultValue={result.q}
                placeholder={t(
                  kind === 'products'
                    ? '商品名称 / 商品编码'
                    : '文章标题 / 简介',
                  kind === 'products'
                    ? 'Product name / SPU'
                    : 'Title / summary',
                )}
                maxLength={150}
              />
            </label>
            {kind === 'products' && result.currencies.length > 1 && (
              <label>
                {t('币种', 'Currency')}
                <select name="currency" defaultValue={result.currency}>
                  <option value="">{t('全部币种', 'All currencies')}</option>
                  {result.currencies.map((c: string) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {t('排序', 'Sort')}
              <select name="sort" defaultValue={result.sort}>
                <option value="default">{t('默认排序', 'Default')}</option>
                <option value="latest">{t('最新发布', 'Latest')}</option>
                {kind === 'products' ? (
                  <>
                    <option value="priceAsc">
                      {t('价格从低到高', 'Price: low to high')}
                    </option>
                    <option value="priceDesc">
                      {t('价格从高到低', 'Price: high to low')}
                    </option>
                  </>
                ) : (
                  <option value="earliest">{t('最早发布', 'Oldest')}</option>
                )}
              </select>
            </label>
            {kind === 'products' && (
              <label className="catalog-stock">
                <input
                  type="checkbox"
                  name="stock"
                  value="1"
                  defaultChecked={query.stock === '1'}
                />
                {t('仅看有货', 'In stock')}
              </label>
            )}
            <button className="btn primary">{t('筛选', 'Apply')}</button>
            <a className="btn" href={`/${lang}/${kind}`}>
              {t('重置', 'Reset')}
            </a>
          </form>
          {kind === 'products' &&
            result.currencies.length > 1 &&
            !result.currency && (
              <p className="muted">
                {t(
                  '价格排序请先选择币种。',
                  'Select a currency to sort by price.',
                )}
              </p>
            )}
        </CatalogFilters>
      </div>
      {result.total ? (
        <ContentCards items={result.rows} en={en} lang={lang} kind={kind} />
      ) : (
        <div className="public-empty">
          <h2>{t('没有找到符合条件的内容', 'No matching results')}</h2>
          <a href={`/${lang}/${kind}`}>{t('清除筛选', 'Clear filters')}</a>
        </div>
      )}
      <nav className="catalog-pagination" aria-label={t('分页', 'Pagination')}>
        {result.page > 1 && (
          <a className="btn" href={href(result.page - 1)}>
            {t('上一页', 'Previous')}
          </a>
        )}
        <span>
          {result.page} / {result.pages}
        </span>
        {result.page < result.pages && (
          <a className="btn" href={href(result.page + 1)}>
            {t('下一页', 'Next')}
          </a>
        )}
      </nav>
    </main>
  );
}
