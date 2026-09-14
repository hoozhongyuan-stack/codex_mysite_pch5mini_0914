'use client';
import SiteLink from '../components/site-link';

import { redemptionDetailHref } from '@/lib/redemption-view.mjs';
import './points-store.css';
import { useEffect, useState } from 'react';
export default function PointsMall({
  en = false,
  admin = false,
  initialRows = [],
}: {
  en?: boolean;
  admin?: boolean;
  initialRows?: any[];
}) {
  const [rows, setRows] = useState<any[]>(initialRows),
    [q, setQ] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [sort, setSort] = useState('default'),
    [affordable, setAffordable] = useState(false),
    [balance, setBalance] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const minPoints = (r: any) =>
    r.variants.length
      ? Math.min(...r.variants.map((v: any) => v.pointsPrice))
      : Infinity;
  const filtered = rows
    .filter(
      (r) =>
        (r.titleZh + ' ' + r.titleEn + ' ' + r.spu)
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (!affordable ||
          (!r.soldOut && balance !== null && minPoints(r) <= balance)),
    )
    .sort((a, b) =>
      sort === 'asc'
        ? minPoints(a) - minPoints(b)
        : sort === 'desc'
          ? minPoints(b) - minPoints(a)
          : 0,
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  useEffect(() => {
    let live = true;
    fetch('/api/mall/list')
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) setRows(d.rows);
      })
      .catch((e) => setMessage(e.message));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    fetch('/api/points/summary')
      .then(async (r) => {
        if (r.ok) setBalance(((await r.json()) as any).balance);
      })
      .catch(() => {});
  }, []);
  const lang = en ? 'en' : 'zh',
    t = (zh: string, eng: string) => (en ? eng : zh);
  return (
    <section
      className="points-workspace points-store"
      style={{ maxWidth: 1200, margin: '32px auto', padding: 24 }}
    >
      <header className="points-heading">
        <div>
          <h1>{t('积分商城', 'Points shop')}</h1>
          <p>
            {t(
              '用积分兑换心仪好物，纯积分兑换，包邮配送。',
              'Redeem your points for products. Free shipping.',
            )}
          </p>
        </div>
        <SiteLink
          className="points-balance-card"
          href={`/${lang}/account?section=points`}
        >
          <span>{t('可用积分', 'Available points')}</span>
          <strong>{balance === null ? '—' : balance.toLocaleString()}</strong>
          <small>
            {balance === null
              ? t('登录查看', 'Sign in to view')
              : t('查看我的积分 →', 'My points →')}
          </small>
        </SiteLink>
      </header>
      {admin && (
        <div className="content-interactions">
          <SiteLink className="btn" href="/admin?view=products">
            配置商品兑换规格、积分及配额
          </SiteLink>
          <SiteLink className="btn" href="/admin?view=orders">
            管理兑换订单
          </SiteLink>
          <button aria-busy={Boolean(busy)}
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch('/api/mall/recover', { method: 'POST' });
                const d: any = await r.json();
                if (!r.ok) throw Error(d.error);
                setMessage(`已恢复 ${d.count} 条，待处理 ${d.failed} 条`);
              } catch (e: any) {
                setMessage(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            恢复待处理兑换
          </button>
        </div>
      )}
      <div className="points-search">
        <input
          aria-label={t('检索商品', 'Search products')}
          placeholder={t('商品名称或编码', 'Product name or code')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label={t('积分排序', 'Sort points')}
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="default">{t('默认排序', 'Default')}</option>
          <option value="asc">
            {t('积分从低到高', 'Points: low to high')}
          </option>
          <option value="desc">
            {t('积分从高到低', 'Points: high to low')}
          </option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={affordable}
            disabled={balance === null}
            onChange={(e) => {
              setAffordable(e.target.checked);
              setPage(1);
            }}
          />{' '}
          {t('仅看我可兑换', 'Within my points balance')}
        </label>
      </div>
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
      <div className="points-mall-grid">
        {filtered.slice((page - 1) * 12, page * 12).map((r) => (
          <article className="points-card" key={r.id}>
            <SiteLink
              className="points-product-link"
              href={redemptionDetailHref(lang, r.slug)}
            >
              {r.imageId && (
                <img
                  src={'/api/media/' + r.imageId}
                  alt={en ? r.titleEn : r.titleZh}
                />
              )}
              <h2>{en ? r.titleEn : r.titleZh}</h2>
            </SiteLink>
            <p>{r.spu}</p>
            <strong>
              {r.variants.length
                ? Math.min(...r.variants.map((v: any) => v.pointsPrice))
                : '—'}{' '}
              {t('积分起', 'points')}
            </strong>
            <p>
              <SiteLink className="btn" href={redemptionDetailHref(lang, r.slug)}>
                {r.soldOut
                  ? t('已兑完 · 查看详情', 'Sold out · Details')
                  : t('查看详情', 'View details')}
              </SiteLink>
            </p>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p>{t('暂无可兑换商品', 'No rewards available yet')}</p>
      )}
      {filtered.length > 0 && (
        <div className="content-interactions">
          <button
            className="btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t('上一页', 'Previous')}
          </button>
          <span>
            {page} / {pages} · {filtered.length}
          </span>
          <button
            className="btn"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            {t('下一页', 'Next')}
          </button>
        </div>
      )}
    </section>
  );
}
