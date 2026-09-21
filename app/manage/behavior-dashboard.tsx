'use client';
import SiteLink from '../../components/site-link';

import { useEffect, useState } from 'react';
const date = (offset = 0) =>
  new Date(Date.now() + 8 * 3600000 + offset * 86400000)
    .toISOString()
    .slice(0, 10);
const labels: any = {
  page_view: '访问',
  cart_add: '加入购物车',
  checkout_start: '进入结算',
  order_submit: '提交订单',
  share: '发起分享',
};
export default function BehaviorDashboard() {
  const [draft, setDraft] = useState({
      start: date(-6),
      end: date(),
      channel: 'all',
    }),
    [query, setQuery] = useState(draft),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setData(null);
    const end = new Date(Date.parse(query.end + 'T00:00:00Z') + 86400000)
      .toISOString()
      .slice(0, 10);
    fetch('/api/behavior-summary?' + new URLSearchParams({ ...query, end }), {
      signal: controller.signal,
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
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [query, revision]);
  const metrics = [
    ['访问次数', 'views'],
    ['匿名访客', 'visitors'],
    ['访问会话', 'sessions'],
    ['有效阅读', 'articleReads'],
    ['收藏操作', 'favorites'],
    ['发起分享', 'shares'], ['分享回流访问', 'shareReturns'],
    ['加购操作', 'cartAdds'],
  ];
  const funnel = (title: string, steps: any[]) => (
    <section className="dash-panel">
      <h2>{title}</h2>
      <div className="behavior-funnel">
        {steps.map((step, i) => (
          <div key={step.event}>
            <small>{labels[step.event]}</small>
            <strong>{step.count}</strong>
            <small>
              {i === 0
                ? '会话数'
                : steps[i - 1].count
                  ? '上一步转化 ' +
                    ((100 * step.count) / steps[i - 1].count).toFixed(1) +
                    '%'
                  : '无可计算基数'}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
  return (
    <div className="dashboard-v1">
      <header className="heading-row">
        <div>
          <h1>行为分析</h1>
          <p className="muted">仅统计授权后的匿名行为；订单提交不代表付款</p>
        </div>
        <small>
          {data?.updatedAt
            ? '更新于 ' + new Date(data.updatedAt).toLocaleTimeString('zh-CN')
            : ''}
        </small>
      </header>
      <form
        className="admin-filter-bar dash-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery({ ...draft });
          setRevision((v) => v + 1);
        }}
      >
        <div className="dash-presets">
          {[1, 7, 30].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => {
                const next = { ...draft, start: date(1 - n), end: date() };
                setDraft(next);
                setQuery(next);
              }}
            >
              {n === 1 ? '今天' : `近${n}天`}
            </button>
          ))}
        </div>
        <label>
          开始日期
          <input
            required
            type="date"
            value={draft.start}
            max={draft.end}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
          />
        </label>
        <label>
          截止日期（含）
          <input
            required
            type="date"
            value={draft.end}
            min={draft.start}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
          />
        </label>
        <label>
          渠道
          <select
            aria-label="行为渠道"
            value={draft.channel}
            onChange={(e) => setDraft({ ...draft, channel: e.target.value })}
          >
            <option value="all">全部渠道</option>
            <option value="website">网站</option>
            <option value="mini">小程序</option>
          </select>
        </label>
        <button aria-busy={Boolean(busy)} className="btn" disabled={busy}>查询 / 刷新</button>
      </form>
      {busy && <p role="status">正在读取行为数据…</p>}
      {error && <p role="alert">{error}</p>}
      {data && !data.available && (
        <section className="dash-panel">{data.reason}</section>
      )}
      {data?.available && (
        <>
          <p className="muted">
            {query.start} 至 {query.end} ·{' '}
            {query.channel === 'all'
              ? '全部渠道'
              : query.channel === 'mini'
                ? '小程序'
                : '网站'}{' '}
            · 可用记录起点{' '}
            {new Date(data.coverageStart).toLocaleString('zh-CN')}
            {data.partial ? '；所选期间包含未采集时间，以下为部分数据。' : ''}
          </p>
          <div className="dash-metrics">
            {metrics.map(([label, key]) => (
              <div className="dash-metric" key={key}>
                <span>{label}</span>
                <strong>{data[key]}</strong>
                <small>
                  {data.previousPartial
                    ? '前期记录不完整，不作环比'
                    : `前期 ${data.previous[key]}`}
                </small>
              </div>
            ))}
          </div>
          <div className="dash-columns">
            {funnel('加购路径 · 同会话顺序转化', data.funnel)}
            {funnel('购买路径 · 包含直接购买', data.directFunnel)}
          </div>
          <div className="dash-columns">
            <section className="dash-panel">
              <h2>视频观看</h2>
              <p>
                开始观看 <strong>{data.videoStarts}</strong> · 有效观看{' '}
                <strong>{data.videoValid}</strong> · 完成观看{' '}
                <strong>{data.videoComplete}</strong>
              </p>
              <p>
                完成率{' '}
                {data.videoStarts
                  ? ((100 * data.videoComplete) / data.videoStarts).toFixed(1) +
                    '%'
                  : '—'}
              </p>
              <small>
                同渠道、会话、视频去重；有效观看累计10秒，完成需实际播放覆盖90%。
              </small>
            </section>
            <section className="dash-panel">
              <h2>每日访问次数</h2>
              <div className="behavior-daily">
                {data.daily.map((d: any) => (
                  <span key={d.date}>
                    {d.date.slice(5)}{' '}
                    <b>
                      {d.date < data.coverageStart.slice(0, 10) ? '—' : d.count}
                    </b>
                  </span>
                ))}
              </div>
            </section>
          </div>
          <div className="dash-columns">
            {[
              ['有效阅读排行', data.articles],
              ['有效视频排行', data.videos],
            ].map(([title, rows]: any) => (
              <section className="dash-panel" key={title}>
                <h2>{title}</h2>
                {rows.length ? (
                  <table className="list-table">
                    <thead>
                      <tr>
                        <th>内容</th>
                        <th>会话数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: any) => (
                        <tr key={r.target}>
                          <td>
                            {r.href ? (
                              <SiteLink href={r.href} target="_blank" rel="noreferrer">
                                {r.title}
                              </SiteLink>
                            ) : (
                              r.title || r.target
                            )}
                          </td>
                          <td>{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">所选期间暂无有效记录</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      <details className="dash-panel">
        <summary>采集范围、口径和局限</summary>
        <p>
          默认关闭，用户同意后开始记录，撤回后停止。仅保存随机标识的哈希、渠道、事件、页面路径、内容标识及服务端时间；不采集邮箱、手机号、表单内容或订单号。仅查询最近90天记录；采集或查询时清理过期记录。系统停用期间需由运维执行清理。
        </p>
        <p>
          阅读需页面可见停留10秒。会话30分钟无活动后更新；不同设备、清理存储及跨渠道无法合并。漏斗按所选日期内同会话事件顺序计算，跨日期边界可能不完整。收藏、加购及订单提交是客户端成功回报，网络阻断或拒绝授权会导致少计，不能用于财务对账。
        </p>
        <p>
          已识别的爬虫请求不计入，但无法保证识别全部自动访问。匿名行为不区分演示/正式用户，也不回填历史数据。当前超过20,000条事件需缩短查询区间。
        </p>
      </details>
    </div>
  );
}
