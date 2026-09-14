'use client';
import SiteLink from '../../components/site-link';

import { useEffect, useRef, useState } from 'react';
import { Gift, ExternalLink } from 'lucide-react';
import Orders from './orders';
import CategoryFilter from './category-filter';
import { mutate } from './shared';
import { assertRedemptionPublish } from '@/lib/redemption-config.mjs';
import { runBatch } from '@/lib/admin-batch.mjs';
import './operations-layout.css';
import { validateTrade } from '@/lib/product-options.mjs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
export default function AdminPointsMall({
  categories = [],
  role = 'editor',
  permissions = [],
}: any) {
  const [tab, setTab] = useState('products'),
    [selected, setSelected] = useState<string[]>([]),
    [loading, setLoading] = useState(false),
    [batchSort, setBatchSort] = useState('0'),
    [outcomes, setOutcomes] = useState<any[]>([]),
    [picker, setPicker] = useState(false),
    [pickCategory, setPickCategory] = useState(''),
    [pickQ, setPickQ] = useState(''),
    [pickPage, setPickPage] = useState(1),
    [choices, setChoices] = useState<any>({ rows: [] }),
    [uniform, setUniform] = useState(''),
    [q, setQ] = useState(''),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(1),
    [result, setResult] = useState<any>({ rows: [] }),
    [edit, setEdit] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const request = useRef(0);
  const reload = async () => {
    const version = ++request.current;
    setSelected([]);
    setLoading(true);
    const r = await fetch(
      '/api/admin/list?' +
        new URLSearchParams({
          kind: 'products',
          mall: 'listed',
          category,
          q,
          page: String(page),
          size: '20',
        }),
    );
    const d: any = await r.json();
    if (version !== request.current) return;
    setLoading(false);
    if (!r.ok) {
      setResult({ rows: [] });
      throw Error(d.error || '读取失败');
    }
    setResult(d);
  };
  useEffect(() => {
    reload().catch((e) => setMessage(e.message));
  }, [q, page, category]);
  useEffect(() => {
    if (!picker) return;
    let live = true;
    setChoices({ rows: [], loading: true });
    fetch(
      '/api/admin/list?' +
        new URLSearchParams({
          kind: 'products',
          q: pickQ,
          category: pickCategory,
          page: String(pickPage),
          size: '20',
        }),
    )
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) setChoices(d);
      })
      .catch((e) => {
        if (live) {
          setMessage(e.message);
          setChoices({ rows: [] });
        }
      });
    return () => {
      live = false;
    };
  }, [picker, pickQ, pickPage, pickCategory]);
  const setTrade = (key: string, value: any) =>
    setEdit((x: any) => ({ ...x, trade: { ...x.trade, [key]: value } }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const publish =
        (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ===
        'publish';
      const updated = {
        ...edit,
        trade: {
          ...edit.trade,
          redemptionEnabled: publish,
          redemptionListed: true,
        },
      };
      if (publish) assertRedemptionPublish(updated);
      await mutate('saveContent', {
        data: { ...updated, trade: validateTrade(updated.trade) },
        expectedUpdatedAt: edit.updatedAt,
        redemptionPublish: publish,
      });
      setEdit(null);
      await reload();
      setMessage('兑换配置已保存');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  const batchChange = async (operation: string) => {
    if (!selected.length || busy || loading) return;
    if (
      !confirm(
        `确认对所选 ${selected.length} 项执行${({ enable: '启用兑换', disable: '停用兑换', sort: '设置排序', remove: '移除兑换资格' } as any)[operation]}？普通商品和历史订单保留。`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      const rows = selected.map((id) =>
        result.rows.find((r: any) => r.id === id),
      );
      const outcomes = await runBatch(selected, async (id: string) => {
        const row = rows.find((r: any) => r?.id === id);
        if (!row) throw Error('记录已变化，请刷新');
        const trade = {
          ...validateTrade(row.trade),
          ...(operation === 'enable'
            ? { redemptionEnabled: true, redemptionListed: true }
            : operation === 'disable'
              ? { redemptionEnabled: false }
              : operation === 'remove'
                ? { redemptionEnabled: false, redemptionListed: false }
                : { redemptionSort: Number(batchSort) }),
        };
        if (
          operation === 'sort' &&
          (!/^\d+$/.test(batchSort) || Number(batchSort) > 999999999)
        )
          throw Error('排序须为0至999999999的整数');
        if (operation === 'enable') assertRedemptionPublish({ ...row, trade });
        await mutate('saveContent', {
          data: { ...row, trade },
          expectedUpdatedAt: row.updatedAt,
          redemptionPublish: operation === 'enable',
        });
      });
      setOutcomes(outcomes);
      await reload();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <div className="section-head">
        <h1>
          <Gift size={24} /> 积分商城
        </h1>
        <div className="mall-heading-actions">
          {tab === 'products' && (
            <button
              className="btn primary"
              onClick={() => {
                setMessage('');
                setPickQ('');
                setPickCategory('');
                setPickPage(1);
                setPicker(true);
              }}
            >
              新增兑换商品
            </button>
          )}
          <SiteLink
            className="btn"
            href="/zh/points-shop"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} /> 前台预览
          </SiteLink>
        </div>
      </div>
      <nav className="points-tabs">
        <button
          aria-pressed={tab === 'products'}
          onClick={() => setTab('products')}
        >
          兑换商品
        </button>
        <button
          aria-pressed={tab === 'orders'}
          onClick={() => setTab('orders')}
        >
          兑换订单
        </button>
      </nav>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {tab === 'orders' ? (
        <Orders pointsOnly role={role} permissions={permissions} />
      ) : (
        <>
          <div className="mall-admin-toolbar">
            <CategoryFilter
              categories={categories}
              value={category}
              onChange={(v: string) => {
                setCategory(v);
                setPage(1);
              }}
            />
            <input
              aria-label="商品名称或编码"
              placeholder="检索商品名称 / SPU"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <span className="muted">此处仅展示已加入积分商城的商品</span>
          </div>
          <div className="panel" style={{ overflowX: 'auto' }}>
            <div className="list-batch">
              <label>
                <input
                  type="checkbox"
                  aria-label="全选当前页兑换商品"
                  disabled={busy || loading || !result.rows.length}
                  checked={
                    !!result.rows.length &&
                    result.rows.every((r: any) => selected.includes(r.id))
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? result.rows.map((r: any) => r.id) : [],
                    )
                  }
                />
                当前页全选
              </label>
              <span>已选 {selected.length} 项</span>
              {[
                ['enable', '批量启用'],
                ['disable', '批量停用'],
                ['remove', '移除兑换资格'],
              ].map(([op, label]) => (
                <button aria-busy={Boolean(busy)}
                  className="btn"
                  key={op}
                  disabled={busy || loading || !selected.length}
                  onClick={() => batchChange(op)}
                >
                  {label}
                </button>
              ))}
              <input
                type="number"
                aria-label="批量排序"
                min={0}
                max={999999999}
                value={batchSort}
                style={{ width: 90 }}
                onChange={(e) => setBatchSort(e.target.value)}
              />
              <button aria-busy={Boolean(busy)}
                className="btn"
                disabled={busy || loading || !selected.length}
                onClick={() => batchChange('sort')}
              >
                设置排序
              </button>
            </div>
            {outcomes.length > 0 && (
              <div className="notice" role="status">
                成功 {outcomes.filter((x) => x.ok).length} 项；失败{' '}
                {outcomes.filter((x) => !x.ok).length} 项
                {outcomes
                  .filter((x) => !x.ok)
                  .map((x) => (
                    <p key={x.id}>
                      {x.id}：{x.error}
                    </p>
                  ))}
              </div>
            )}
            <table className="mall-admin-table">
              <thead>
                <tr>
                  {[
                    '选择',
                    '商品',
                    '兑换积分',
                    '总配额 / 每人限兑',
                    '已占用配额',
                    '状态',
                    '排序',
                    '操作',
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r: any) => {
                  const trade: any = {
                    redemptionQuota: 0,
                    redemptionLimit: 0,
                    redemptionSort: 0,
                    redemptionEnabled: false,
                    ...validateTrade(r.trade),
                  };
                  const prices = trade.variants
                    .filter((v: any) => v.enabled && v.pointsPrice)
                    .map((v: any) => v.pointsPrice);
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={'选择兑换商品 ' + r.titleZh}
                          checked={selected.includes(r.id)}
                          disabled={busy || loading}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, r.id]
                                : selected.filter((id) => id !== r.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <div className="mall-product">
                          {r.imageId && (
                            <img src={'/api/media/' + r.imageId} alt="" />
                          )}
                          <div>
                            <b>{r.titleZh}</b>
                            <small>{r.spu || '未设置编码'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {prices.length
                          ? `${Math.min(...prices)} 积分起`
                          : '未配置'}
                      </td>
                      <td>
                        {trade.redemptionQuota || 0} /{' '}
                        {trade.redemptionLimit || '不限'}
                      </td>
                      <td>{r.redemptionUsed || 0}</td>
                      <td>
                        <span className="pill">
                          {trade.redemptionEnabled ? '已启用' : '未启用'}
                        </span>{' '}
                        {r.status === 'published' ? '已发布' : '未发布'}
                      </td>
                      <td>{trade.redemptionSort}</td>
                      <td>
                        <button
                          className="btn"
                          onClick={() => {
                            setMessage('');
                            setEdit({ ...r, trade });
                          }}
                        >
                          配置兑换
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!result.rows.length && (
              <p className="member-empty">
                尚未添加兑换商品，请点击“新增兑换商品”。
              </p>
            )}
            <div className="member-pager" style={{ padding: 16 }}>
              <span>共 {result.total || 0} 条</span>
              <button
                className="btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </button>
              <span>
                {result.page || 1} / {result.pages || 1}
              </span>
              <button
                className="btn"
                disabled={page >= (result.pages || 1)}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </button>
            </div>
          </div>
          <details style={{ marginTop: 24 }}>
            <summary>异常处理</summary>
            <p className="muted">重试因服务暂时不可用而未完成的积分兑换。</p>
            <button aria-busy={Boolean(busy)}
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch('/api/mall/recover', {
                    method: 'POST',
                  });
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
              重试待处理兑换
            </button>
          </details>
        </>
      )}
      {picker && (
        <Dialog open onOpenChange={setPicker}>
          <DialogContent className="mall-product-picker">
            <DialogHeader>
              <DialogTitle>新增兑换商品 · 选择普通商品</DialogTitle>
            </DialogHeader>
            <div className="mall-picker-filters">
              <input
                className="points-search"
                aria-label="检索普通商品"
                placeholder="商品名称 / SPU"
                value={pickQ}
                onChange={(e) => {
                  setPickQ(e.target.value);
                  setPickPage(1);
                }}
              />
              {message && <p role="alert">{message}</p>}
              <CategoryFilter
                categories={categories}
                value={pickCategory}
                onChange={(v: string) => {
                  setPickCategory(v);
                  setPickPage(1);
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPickCategory('');
                  setPickQ('');
                  setPickPage(1);
                }}
              >
                重置
              </button>
            </div>
            <div className="mall-picker-list">
              {choices.loading ? (
                <p role="status">加载商品中…</p>
              ) : choices.rows.length === 0 ? (
                <p>未找到匹配商品</p>
              ) : null}
              {choices.rows.map((r: any) => {
                const listed =
                  r.trade?.redemptionListed ?? r.trade?.redemptionEnabled;
                return (
                  <button
                    disabled={listed}
                    key={r.id}
                    onClick={() => {
                      setEdit({
                        ...r,
                        trade: {
                          redemptionQuota: 0,
                          redemptionLimit: 0,
                          redemptionSort: 0,
                          ...validateTrade(r.trade),
                          redemptionListed: true,
                          redemptionEnabled: false,
                        },
                      });
                      setPicker(false);
                      setUniform('');
                    }}
                  >
                    {r.imageId && (
                      <img src={'/api/media/' + r.imageId} alt="" />
                    )}
                    <span>
                      <b>{r.titleZh}</b>
                      <small>
                        {r.spu || '未设置编码'} · 库存{' '}
                        {r.trade?.inventory ?? '未设置'} ·{' '}
                        {listed
                          ? '已加入兑换'
                          : r.status === 'published'
                            ? '已发布'
                            : '未发布'}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="member-pager">
              <button
                className="btn"
                disabled={pickPage <= 1}
                onClick={() => setPickPage(pickPage - 1)}
              >
                上一页
              </button>
              {choices.page || 1} / {choices.pages || 1}
              <button
                className="btn"
                disabled={pickPage >= (choices.pages || 1)}
                onClick={() => setPickPage(pickPage + 1)}
              >
                下一页
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {edit && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v && !busy) setEdit(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>兑换信息 · {edit.titleZh}</DialogTitle>
            </DialogHeader>
            <form className="mall-config" onSubmit={save}>
              {[
                ['redemptionQuota', '累计兑换总配额'],
                ['redemptionLimit', '每人限兑数量'],
                ['redemptionSort', '排序（小值在前）'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    max={999999999}
                    required
                    value={edit.trade[key]}
                    onChange={(e) => setTrade(key, Number(e.target.value))}
                  />
                </label>
              ))}
              <p className="muted">
                总配额填 0 不可兑换，每人限兑填 0
                表示不限；配额是累计总数，兑换仍受商品库存限制。
              </p>
              <h3>各规格所需积分</h3>
              <div className="flex-actions">
                <input
                  aria-label="统一积分"
                  type="number"
                  min={1}
                  max={1000000}
                  value={uniform}
                  onChange={(e) => setUniform(e.target.value)}
                />
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    if (Number(uniform) > 0)
                      setTrade(
                        'variants',
                        edit.trade.variants.map((v: any) => ({
                          ...v,
                          pointsPrice: v.enabled
                            ? Number(uniform)
                            : v.pointsPrice,
                        })),
                      );
                  }}
                >
                  统一设置积分
                </button>
              </div>
              {edit.trade.variants.map((v: any) => (
                <label key={v.key}>
                  <span>
                    {edit.trade.specs
                      .map((s: any) =>
                        s.values
                          .filter((x: any) => v.key.split('~').includes(x.id))
                          .map((x: any) => x.nameZh)
                          .join('/'),
                      )
                      .join(' / ') || '默认规格'}
                    {!v.enabled ? '（规格已停用）' : ''}
                  </span>
                  <input
                    aria-label={'积分 ' + v.key}
                    type="number"
                    min={1}
                    max={1000000}
                    value={v.pointsPrice ?? ''}
                    onChange={(e) =>
                      setTrade(
                        'variants',
                        edit.trade.variants.map((row: any) =>
                          row.key === v.key
                            ? {
                                ...row,
                                pointsPrice:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <p className="muted">
                积分留空的规格不可兑换。商品正文、售价及库存保持原值。
              </p>
              {message && <p role="alert">{message}</p>}
              <div className="flex-actions">
                <button aria-busy={Boolean(busy)} className="btn" value="draft" disabled={busy}>
                  保存草稿
                </button>
                <button aria-busy={Boolean(busy)} className="btn primary" value="publish" disabled={busy}>
                  保存并上架
                </button>
                <button aria-busy={Boolean(busy)}
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await mutate('saveContent', {
                        data: {
                          ...edit,
                          trade: {
                            ...edit.trade,
                            redemptionEnabled: false,
                            redemptionListed: false,
                          },
                        },
                        expectedUpdatedAt: edit.updatedAt,
                      });
                      setEdit(null);
                      await reload();
                      setMessage('已移除兑换资格，普通商品和历史订单保留');
                    } catch (e: any) {
                      setMessage(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  移除兑换资格
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
