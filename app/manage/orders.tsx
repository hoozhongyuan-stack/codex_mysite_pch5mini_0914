'use client';
import { useEffect, useRef, useState } from 'react';
import { ordersApi, money } from '../order-shared';
import { orderStatuses } from '@/lib/order-domain.mjs';
import { csv } from '@/lib/list-domain.mjs';
import { Field, Choice } from './shared';
import OrderSettings from './order-settings';
import OrderDetail from './order-detail';
import OrderBatch from './order-batch';
import './operations-layout.css';
export default function Orders({
  initialTab = 'list',
  pointsOnly = false,
  role = 'editor',
  permissions = [],
}: any) {
  const can = (action: string) =>
    role === 'owner' || permissions.includes('orders.' + action);
  const incoming = typeof window==='undefined'?new URLSearchParams():new URLSearchParams(window.location.search);
  const [filters, setFilters] = useState({
    q: '',
    pointsOnly: pointsOnly ? '1' : '',
    status: incoming.get('status') ||
      (initialTab === 'review'
        ? 'pending_review'
        : initialTab === 'aftersale'
          ? 'aftersale'
          : ''),
    sandbox: incoming.get('sandbox') || '0',
    channel: incoming.get('channel')||'all',
    dateBasis: incoming.get('dateBasis')||'created',
    orderType: incoming.get('orderType')||'',
    page: 1,
    pageSize: 20,
    from: incoming.get('from')||'',
    to: incoming.get('to')||'',
  });
  const [result, setResult] = useState<any>({ rows: [] }),
    [stats, setStats] = useState<any[]>([]),
    [order, setOrder] = useState<any>(null),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [batch, setBatch] = useState(''),
    [outcomes, setOutcomes] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const request = useRef(0);
  const reload = async () => {
    const version = ++request.current;
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        ordersApi('admin-list', filters),
        ordersApi('admin-stats', filters),
      ]);
      if (version === request.current) {
        setResult(r);
        setStats(s.rows);
        setError('');
      }
    } finally {
      if (version === request.current) setLoading(false);
    }
  };
  useEffect(() => {
    setSelected([]);
    if (initialTab !== 'settings') reload().catch((e) => setError(e.message));
    return () => {
      request.current++;
    };
  }, [filters, initialTab]);
  const exportRows = async (onlySelected: boolean) => {
    setBusy(true);
    setError('');
    try {
      const r = await ordersApi(
        'admin-export',
        {
          ...filters,
          sandbox: filters.sandbox,
          pointsOnly,
          ...(onlySelected ? { selected } : {}),
        },
        true,
      );
      const rows = [
        [
          '订单号',
          '状态',
          '币种',
          pointsOnly ? '积分' : '金额',
          '收货人',
          '邮箱',
          '创建时间',
        ],
        ...r.rows.map((o: any) => [
          o.order_number || o.id,
          (orderStatuses as any)[o.status],
          o.currency,
          o.currency === 'PTS' ? String(o.total) : (o.total / 100).toFixed(2),
          o.name,
          o.email,
          o.created_at,
        ]),
      ];
      const url = URL.createObjectURL(
        new Blob(['\ufeff' + csv(rows)], { type: 'text/csv;charset=utf-8' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = onlySelected ? '所选订单.csv' : '筛选订单.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (order)
    return (
      <OrderDetail
        role={role}
        permissions={permissions}
        order={order}
        onBack={() => {
          setOrder(null);
          reload().catch((e) => setError(e.message));
        }}
        reload={async () =>
          setOrder(await ordersApi('admin-detail', { id: order.id }))
        }
      />
    );
  if (initialTab === 'settings') return <OrderSettings />;
  return (
    <section className="operations-page">
      {!pointsOnly && (
        <div className="heading-row">
          <h1>
            {initialTab === 'review'
              ? '付款审核'
              : initialTab === 'aftersale'
                ? '售后管理'
                : '订单管理'}
          </h1>
          <button aria-busy={Boolean(busy)}
            className="btn"
            hidden={!can('export')}
            disabled={busy || loading}
            onClick={() => exportRows(false)}
          >
            导出筛选结果
          </button>
        </div>
      )}
      {stats.length > 0 && (
        <div className="operation-metrics">
          {stats.map((s) => (
            <div key={s.currency}>
              <span>
                {s.currency === 'PTS' ? '兑换订单' : s.currency} · {s.count} 单
              </span>
              <strong>待发货 {s.pendingShip}</strong>
              <small>
                {s.currency === 'PTS' ? '兑换总积分' : '实收'}{' '}
                {money(s.received || 0, s.currency)} ·{' '}
                {s.currency === 'PTS' ? '已退积分' : '退款'}{' '}
                {money(s.refunded || 0, s.currency)}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="operation-status-tabs" aria-label="订单状态">
        {[['', '全部'], ...Object.entries(orderStatuses)].map(
          ([key, label]) => (
            <button
              key={key}
              aria-pressed={filters.status === key}
              onClick={() => setFilters({ ...filters, status: key, page: 1 })}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <p className="muted">统计日期：{filters.dateBasis==='paid'?'首次确认收款时间':'下单时间'} · 中国标准时间；渠道：{({all:'全部',mini:'小程序',website:'网站',unknown:'未知来源'} as Record<string,string>)[filters.channel]||filters.channel}；数据：{filters.sandbox==='all'?'全部':filters.sandbox==='1'?'测试':'正式'}</p><div className="operation-filters">
        <Field
          label="搜索订单"
          placeholder="订单号 / 收货人 / 邮箱 / 手机 / SPU / 物流号"
          value={filters.q}
          onChange={(q: string) => setFilters({ ...filters, q, page: 1 })}
        />
        <Field
          label={filters.dateBasis==='paid'?'首次确认收款起日':'下单日期起'}
          type="date"
          value={filters.from?new Date(Date.parse(filters.from)+8*3600000).toISOString().slice(0,10):''}
          onChange={(v: string) =>
            setFilters({
              ...filters,
              from: v ? new Date(v+'T00:00:00+08:00').toISOString() : '',
              page: 1,
            })
          }
        />
        <Field
          label={filters.dateBasis==='paid'?'首次确认收款截止（不含）':'下单日期止（不含）'}
          type="date"
          value={filters.to?new Date(Date.parse(filters.to)+8*3600000).toISOString().slice(0,10):''}
          onChange={(v: string) =>
            setFilters({
              ...filters,
              to: v ? new Date(v+'T00:00:00+08:00').toISOString() : '',
              page: 1,
            })
          }
        />
        <button
          className="btn"
          onClick={() =>
            setFilters({
              ...filters,
              q: '',
              status: '',
              dateBasis:'created',channel:'all',orderType:'',sandbox:'0',
              from: '',
              to: '',
              page: 1,
            })
          }
        >
          重置
        </button>
        {pointsOnly && (
          <button aria-busy={Boolean(busy)}
            className="btn"
            hidden={!can('export')}
            disabled={busy || loading}
            onClick={() => exportRows(false)}
          >
            导出筛选结果
          </button>
        )}
      </div>
      <div className="list-batch">
        <label>
          <input
            type="checkbox"
            aria-label="全选当前页订单"
            disabled={loading || !result.rows.length}
            checked={
              !!result.rows.length &&
              result.rows.every((r: any) => selected.includes(r.id))
            }
            onChange={(e) =>
              setSelected(
                e.target.checked ? result.rows.map((r: any) => r.id) : [],
              )
            }
          />{' '}
          当前页全选
        </label>
        <span>已选 {selected.length} 条</span>
        <button aria-busy={Boolean(busy)}
          className="btn"
          hidden={!can('export')}
          disabled={!selected.length || busy || loading}
          onClick={() => exportRows(true)}
        >
          导出所选
        </button>
        {pointsOnly && (
          <>
            <button aria-busy={Boolean(loading)}
              className="btn"
              hidden={!can('fulfill')}
              disabled={!selected.length || loading}
              onClick={() => setBatch('ship')}
            >
              批量发货
            </button>
            <button aria-busy={Boolean(loading)}
              className="btn"
              hidden={!can('aftersale')}
              disabled={!selected.length || loading}
              onClick={() => setBatch('close')}
            >
              批量关闭
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {outcomes.length > 0 && (
        <div className="notice" role="status">
          成功 {outcomes.filter((x) => x.ok).length} 条，失败{' '}
          {outcomes.filter((x) => !x.ok).length} 条
          {outcomes
            .filter((x) => !x.ok)
            .map((x) => (
              <p key={x.id}>
                {x.id}：{x.error}
              </p>
            ))}
        </div>
      )}
      <div className="panel">
        <div className="operations-table-scroll" aria-busy={Boolean(loading)} inert={loading}>
          <table className="list-table">
            <thead>
              <tr>
                {[
                  '选择',
                  '订单号',
                  '状态',
                  '收货人',
                  pointsOnly ? '积分' : '金额',
                  '下单时间',
                  '操作',
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading&&!result.rows.length&&Array.from({length:5},(_,i)=><tr key={i}><td colSpan={7}><span className="list-skeleton-line"/></td></tr>)}
              {result.rows.map((o: any) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={'选择订单 ' + (o.order_number || o.id)}
                        checked={selected.includes(o.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, o.id]
                              : selected.filter((id) => id !== o.id),
                          )
                        }
                      />
                    </td>
                    <td>{o.order_number || o.id}</td>
                    <td>
                      <span className="pill">
                        {(orderStatuses as any)[o.status]}
                      </span>
                    </td>
                    <td>{o.name}</td>
                    <td>{money(o.total, o.currency)}</td>
                    <td>{new Date(o.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="btn"
                        onClick={() =>
                          ordersApi('admin-detail', { id: o.id })
                            .then(setOrder)
                            .catch((e) => setError(e.message))
                        }
                      >
                        详情 / 处理
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <p className="empty-state" role="status">
            {result.rows.length?'正在更新，当前显示上次结果…':'正在加载订单…'}
          </p>
        ) : (
          !result.rows.length && (
            <p className="empty-state">当前条件下暂无订单</p>
          )
        )}
        <div className="list-pager">
          <span>共 {result.total || 0} 条</span>
          <Choice
            label="每页"
            value={String(filters.pageSize)}
            items={['20', '50', '100'].map((v) => [v, v + '条'])}
            onChange={(v: string) =>
              setFilters({ ...filters, pageSize: Number(v), page: 1 })
            }
          />
          <button aria-busy={Boolean(loading)}
            className="btn"
            disabled={loading || (result.page || 1) <= 1}
            onClick={() => setFilters({ ...filters, page: result.page - 1 })}
          >
            上一页
          </button>
          <span>
            {result.page || 1} / {result.pages || 1}
          </span>
          <button aria-busy={Boolean(loading)}
            className="btn"
            disabled={loading || (result.page || 1) >= (result.pages || 1)}
            onClick={() => setFilters({ ...filters, page: result.page + 1 })}
          >
            下一页
          </button>
        </div>
      </div>
      {batch && (
        <OrderBatch
          rows={result.rows.filter((r: any) => selected.includes(r.id))}
          operation={batch}
          onClose={() => setBatch('')}
          onDone={(r: any[]) => {
            setBatch('');
            setOutcomes(r);
            setSelected([]);
            reload().catch((e) => setError(e.message));
          }}
        />
      )}
    </section>
  );
}
