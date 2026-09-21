'use client';
import SiteLink from '../../components/site-link';

import { useEffect, useState } from 'react';
import { delta } from '@/lib/dashboard-domain.mjs';
import './dashboard.css';
import BehaviorDashboard from './behavior-dashboard';
const day = (n = 0) =>
  new Date(Date.now() + 8 * 3600000 + n * 86400000).toISOString().slice(0, 10);
const reason = (m: any) =>
  m?.reason === 'permission'
    ? '无查看权限'
    : m?.reason === 'channel_unavailable'
      ? '暂无可靠渠道记录'
      : m?.reason || '暂不可统计';
const money = (n: number, c: string) =>
  `${c} ${(n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function Metric({ label, value, metric, href, note }: any) {
  return (
    <div className="dash-metric">
      <span>{label}</span>
      <strong>{value ?? (metric?.available ? metric.current : '—')}</strong>
      <small>
        {metric?.available
          ? `较上一等长周期 ${delta(metric.current, metric.previous)}`
          : reason(metric)}
      </small>
      {note && <small>{note}</small>}
      {href && <SiteLink href={href}>查看明细 ↗</SiteLink>}
    </div>
  );
}
function Trend({ title, items }: any) {
  const valid = items.filter((i: any) => i.metric?.available),
    max = Math.max(
      1,
      ...valid.flatMap((i: any) => i.metric.daily.map((d: any) => d.count)),
    );
  return (
    <section className="dash-panel">
      <h2>{title}</h2>
      <div className="dash-legend">
        {items.map((i: any) => (
          <span key={i.name} style={{ color: i.color }}>
            {i.name}
            {!i.metric?.available ? ' · ' + reason(i.metric) : ''}
          </span>
        ))}
      </div>
      {valid.length ? (
        <>
          <div
            className="dash-chart"
            role="img"
            aria-label={title + '，可展开每日数据查看准确数值'}
          >
            {valid[0].metric.daily.map((d: any, index: number) => (
              <div
                className="dash-day"
                key={d.date}
                title={
                  d.date +
                  ' ' +
                  valid
                    .map(
                      (i: any) => i.name + ': ' + i.metric.daily[index]?.count,
                    )
                    .join('，')
                }
              >
                {valid.map((i: any) => (
                  <div
                    key={i.name}
                    style={{
                      height: Math.max(
                        1,
                        ((i.metric.daily[index]?.count || 0) / max) * 110,
                      ),
                      background: i.color,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="dash-axis">
            <span>{valid[0].metric.daily[0]?.date}</span>
            <span>{valid[0].metric.daily.at(-1)?.date}</span>
          </div>
          <details>
            <summary>查看每日数据</summary>
            <div className="dash-scroll">
              <table className="list-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    {valid.map((i: any) => (
                      <th key={i.name}>{i.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valid[0].metric.daily.map((d: any, index: number) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      {valid.map((i: any) => (
                        <td key={i.name}>
                          {i.metric.daily[index]?.count || 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="muted">暂无可统计数据</p>
      )}
    </section>
  );
}
function Overview() {
  const [draft, setDraft] = useState({
      start: day(-6),
      end: day(),
      channel: 'all',
      dataMode: 'all',
    }),
    [query, setQuery] = useState(draft),
    [version, setVersion] = useState(0),
    [data, setData] = useState<any>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    setBusy(true);
    setError('');
    const end = new Date(Date.parse(query.end + 'T00:00:00Z') + 86400000)
      .toISOString()
      .slice(0, 10);
    fetch('/api/dashboard?' + new URLSearchParams({ ...query, end }), {
      signal: c.signal,
    })
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error || '读取失败');
        setData(d);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setBusy(false);
      });
    return () => c.abort();
  }, [query, version]);
  const apply = (e: any) => {
    e.preventDefault();
    if (draft.start > draft.end) {
      setError('开始日期不能晚于结束日期');
      return;
    }
    setQuery({ ...draft });
    setVersion((v) => v + 1);
  };
  const preset = (n: number) => {
    const next = {
      ...draft,
      start: day(n === -1 ? -1 : 1 - n),
      end: day(n === -1 ? -1 : 0),
    };
    setDraft(next);
    setQuery(next);
  };
  const trade = data?.trade,
    leads = data?.leads,
    geo = data?.geo,
    newMembers = data?.members?.metrics?.newMembers || data?.members,
    registrations = data?.members?.metrics?.validRegistrations || data?.members;
  const orderLink = (status = '', dated = false, points = false) =>
    '/admin?' +
    new URLSearchParams({
      view: 'orders',
      status,
      orderType: points ? 'points' : 'cash',
      sandbox:
        data?.dataMode === 'all'
          ? 'all'
          : data?.dataMode === 'demo'
            ? '1'
            : '0',
      channel: data?.channel || 'all',
      ...(dated && data
        ? {
            from: data.period.startAt,
            to: data.period.endAt,
            dateBasis: 'paid',
          }
        : {}),
    });
  return (
    <div className="dashboard-v1">
      <header className="heading-row">
        <div>
          <h1>经营与运营总览</h1>
          <p className="muted">观察近期变化，处理当前待办</p>
        </div>
        <span className="muted">
          {busy
            ? '正在更新…'
            : data
              ? '更新于 ' + new Date(data.updatedAt).toLocaleTimeString('zh-CN')
              : '尚未读取'}
        </span>
      </header>
      <form className="admin-filter-bar dash-filters" onSubmit={apply}>
        <div className="dash-presets">
          {[
            ['今天', 1],
            ['昨天', -1],
            ['近7天', 7],
            ['近30天', 30],
          ].map(([label, n]) => (
            <button
              key={label}
              type="button"
              className="btn"
              onClick={() => preset(Number(n))}
            >
              {label}
            </button>
          ))}
        </div>
        <label>
          开始日期
          <input
            aria-label="统计开始日期"
            type="date"
            required
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
        </label>
        <label>
          结束日期（含）
          <input
            aria-label="统计结束日期"
            type="date"
            required
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
        </label>
        <label>
          渠道
          <select
            aria-label="渠道"
            value={draft.channel}
            onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
          >
            <option value="all">全部渠道</option>
            <option value="website">网站</option>
            <option value="mini">小程序</option>
            <option value="unknown">未知来源</option>
          </select>
        </label>
        <label>
          数据范围
          <select
            aria-label="数据范围"
            value={draft.dataMode}
            onChange={(e) => setDraft({ ...draft, dataMode: e.target.value })}
          >
            <option value="all">全部数据</option>
            <option value="formal">排除明确测试数据</option>
            <option value="demo">仅明确测试数据</option>
          </select>
        </label>
        <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
          查询 / 刷新
        </button>
      </form>
      {error && (
        <p role="alert" className="notice">
          {error}；当前保留的是上次结果。
        </p>
      )}
      {!data ? (
        <p role="status" className="notice">{busy ? '正在汇总业务数据…' : '请重新查询'}</p>
      ) : (
        <div aria-busy={Boolean(busy)} style={{ opacity: busy ? 0.55 : 1 }}>
          <p className="dash-range">
            统计范围：{data.period.start} 至{' '}
            {new Date(Date.parse(data.period.end + 'T00:00:00Z') - 86400000)
              .toISOString()
              .slice(0, 10)}{' '}
            · 中国标准时间 · 最长90天 ·{' '}
            {
              (
                {
                  all: '全部渠道',
                  website: '网站',
                  mini: '小程序',
                  unknown: '未知来源',
                } as Record<string, string>
              )[data.channel]
            }{' '}
            ·{' '}
            {
              (
                {
                  all: '全部数据',
                  formal: '排除明确测试数据',
                  demo: '仅明确测试数据',
                } as Record<string, string>
              )[data.dataMode]
            }
          </p>
          <div className="dash-metrics">
            <Metric
              label="确认收款金额"
              value={
                trade?.available
                  ? trade.money.length
                    ? trade.money.map((m: any) => (
                        <span key={m.currency}>
                          {money(m.received, m.currency)}
                          <small>
                            较上一周期 {delta(m.received, m.previousReceived)}
                          </small>
                          <small>
                            本期退款 {money(m.refunded, m.currency)}
                          </small>
                        </span>
                      ))
                    : '暂无收款'
                  : undefined
              }
              metric={
                trade?.available
                  ? {
                      available: false,
                      reason: '按审核确认时间统计，分币种展示',
                    }
                  : trade
              }
              href={trade?.available ? orderLink('', true) : null}
            />
            <Metric
              label="成交订单"
              metric={trade}
              href={trade?.available ? orderLink('', true) : null}
            />
            <Metric
              label="新增会员"
              metric={newMembers}
              href={
                newMembers?.available
                  ? '/admin?view=users&dashboard=1&start=' +
                    data.period.start +
                    '&end=' +
                    data.period.end +
                    '&dataMode=' +
                    data.dataMode
                  : null
              }
            />
            <Metric
              label="表单提交"
              metric={leads}
              href={
                leads?.available
                  ? '/admin?view=submissions&dashboard=1&start=' +
                    data.period.start +
                    '&end=' +
                    data.period.end +
                    '&channel=' +
                    data.channel
                  : null
              }
            />
            <Metric
              label="有效报名"
              metric={registrations}
              note="所选期间报名且当前未取消"
            />
            <Metric
              label="AI 来源访问"
              metric={geo}
              href={geo?.available ? '/admin?view=geo' : null}
            />
          </div>
          <section className="dash-panel">
            <h2>
              当前待办 <small>不受历史日期筛选影响</small>
            </h2>
            <div className="dash-todos">
              {trade?.available ? (
                trade.todos.map((t: any) => (
                  <SiteLink key={t.status} href={orderLink(t.status)}>
                    <b>{t.count}</b>
                    <span>
                      {
                        (
                          {
                            pending_review: '待审核收款',
                            pending_ship: '待发货',
                            aftersale: '待处理售后',
                          } as Record<string, string>
                        )[t.status]
                      }
                    </span>
                    <span>→</span>
                  </SiteLink>
                ))
              ) : (
                <span>{reason(trade)}</span>
              )}
              {leads?.available && (
                <SiteLink
                  href={
                    '/admin?view=submissions&status=pending&channel=' +
                    data.channel
                  }
                >
                  <b>{leads.pending}</b>待处理表单 →
                </SiteLink>
              )}
              {data.stock?.available && (
                <SiteLink
                  href={
                    '/admin?view=products&lowStock=1&dashChannel=' +
                    data.channel
                  }
                >
                  <b>{data.stock.count}</b>低库存商品（≤5） →
                </SiteLink>
              )}
              {trade?.available && (
                <SiteLink href={orderLink('pending_ship', false, true)}>
                  <b>{trade.pointPending}</b>兑换待发货 →
                </SiteLink>
              )}
            </div>
            {!data.stock?.available && (
              <small>库存：{reason(data.stock)}</small>
            )}
          </section>
          <div className="dash-columns">
            <Trend
              title="成交趋势"
              items={[
                { name: '确认成交订单', color: '#7055d8', metric: trade },
              ]}
            />
            <Trend
              title="会员与线索趋势"
              items={[
                { name: '新增会员', color: '#7055d8', metric: newMembers },
                { name: '表单提交', color: '#359986', metric: leads },
              ]}
            />
          </div>
          <div className="dash-columns">
            <section className="dash-panel">
              <h2>
                商品成交排行 <small>按售出件数 · 前5项</small>
              </h2>
              {trade?.available ? (
                trade.ranking.length ? (
                  <table className="list-table">
                    <thead>
                      <tr>
                        <th>商品</th>
                        <th>件数</th>
                        <th>商品金额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trade.ranking.map((r: any) => (
                        <tr key={r.id + r.currency}>
                          <td>{r.title}</td>
                          <td>{r.quantity}</td>
                          <td>{money(r.amount, r.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">本期暂无成交商品</p>
                )
              ) : (
                <p>{reason(trade)}</p>
              )}
              <small>以首次收款确认订单计，金额不含运费，退款另列。</small>
            </section>
            <section className="dash-panel">
              <h2>GEO 与数据状态</h2>
              <p>
                AI 爬虫请求：{geo?.available ? geo.bots : reason(geo)}{' '}
                <small>所选期间，依据请求声明</small>
              </p>
              <p>
                引用证据记录：{geo?.available ? geo.evidence : reason(geo)}{' '}
                <small>累计记录，需人工核验</small>
              </p>
              {geo?.available && (
                <SiteLink href="/admin?view=geo">进入 GEO 实时技术检查 →</SiteLink>
              )}
              <p className="muted">
                本页不推断收录或引用效果。运行服务状态未接入监控。
              </p>
              <small>
                数据读取：订单{trade?.available ? '正常' : '不可用'} · 表单
                {leads?.available ? '正常' : '不可用'} · 会员
                {newMembers?.available ? '正常' : '不可用'}
              </small>
            </section>
          </div>
          <details className="dash-panel">
            <summary>统计口径与当前能力</summary>
            <p>
              收款与成交以首次审核通过时间为准；退款按退款操作记录时间统计。积分兑换不计入现金成交。同一币种金额独立汇总。待办反映当前状态。
            </p>
            <p>
              报名按提交时间且当前未取消计算。渠道依据持久化来源，未记录来源归为未知；不根据登录方式推断渠道。测试数据仅使用明确标记。
            </p>
            <p>
              内容阅读、视频观看及购买漏斗可切换“行为分析”查看；匿名访客按渠道统计，无法跨端合并。
            </p>
          </details>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState('overview');
  return (
    <>
      <div className="behavior-tabs" role="tablist" aria-label="统计面板">
        <button
          role="tab"
          aria-selected={tab === 'overview'}
          onClick={() => setTab('overview')}
        >
          经营总览
        </button>
        <button
          role="tab"
          aria-selected={tab === 'behavior'}
          onClick={() => setTab('behavior')}
        >
          行为分析
        </button>
      </div>
      {tab === 'overview' ? <Overview /> : <BehaviorDashboard />}
    </>
  );
}
