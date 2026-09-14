'use client';
import SiteLink from '../../components/site-link';

import './operations-layout.css';
import { useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Field, Choice } from './shared';
import { marketingApi, Pager } from './marketing-shared';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
export default function SalonDetail({
  detail,
  onBack,
  onReload,
  role = 'editor',
  permissions = [],
}: any) {
  const can = (action: string) =>
    role === 'owner' || permissions.includes('marketing.' + action);
  const { event, stats } = detail;
  const [tab, setTab] = useState('registrations'),
    [qrOpen, setQrOpen] = useState(false),[qrImage,setQrImage]=useState('');
  const request=useRef(0);
  const [result, setResult] = useState<any>({ rows: [] }),
    [filters, setFilters] = useState({
      q: '',
      company: '',
      from: '',
      to: '',
      pageSize: 20,
      status: '',
      checked: '',
      page: 1,
    }),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [row, setRow] = useState<any>(null),
    [reason, setReason] = useState('');
  const reload = async () => {
    const version=++request.current;setSelected([]);setResult({rows:[]});
    const next=await marketingApi('admin-registrations',{id:event.id,...filters});
    if(version===request.current)setResult(next);
  };
  useEffect(()=>{reload().catch(e=>setError(e.message));return()=>{request.current++;};},[event.id,filters]);
  useEffect(()=>{if(!qrOpen)return;let active=true;setQrImage('');marketingApi('admin-qr',{id:event.id}).then(d=>{if(active)setQrImage('data:image/png;base64,'+d.png);}).catch(e=>setError(e.message));return()=>{active=false;};},[qrOpen,event.id]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const exportRows = (all: boolean) =>
    run(async () => {
      const d = await marketingApi(
        'admin-export',
        { id: event.id, ...filters, ...(!all ? { selected } : {}) },
        true,
      );
      const cells = (v: any) =>
        '"' +
        String(v ?? '')
          .replace(/^(?:\s*[=+@-]|[\t\r\n])/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const keys = [
        ...new Set<string>(
          d.rows.flatMap((r: any) => r.fields.map((f: any) => f.id)),
        ),
      ];
      const labels = keys.map(
        (k) =>
          d.rows.flatMap((r: any) => r.fields).find((f: any) => f.id === k)
            ?.labelZh || k,
      );
      const rows = [
        [
          '报名编号',
          '姓名',
          '邮箱',
          '报名时间',
          '状态',
          '签到时间',
          '签到方式',
          '操作人',
          ...labels,
        ],
        ...d.rows.map((r: any) => [
          r.id,
          r.name,
          r.email,
          r.created,
          r.status,
          r.checkedAt,
          r.checkinMethod,
          r.checkinActor,
          ...keys.map((k) => r.answers[k]),
        ]),
      ];
      const url = URL.createObjectURL(
        new Blob(
          ['\ufeff' + rows.map((r) => r.map(cells).join(',')).join('\r\n')],
          { type: 'text/csv;charset=utf-8' },
        ),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = '沙龙报名名单.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  return (
    <section className="operations-page">
      <div className="salon-detail-header">
        <button className="btn" onClick={onBack}>
          <ArrowLeft />
          活动列表
        </button>
        <h1>{event.titleZh}</h1>
      </div>
      <div className="operation-status-tabs">
        {[
          ['info', '活动信息'],
          ['registrations', '报名记录'],
          ['stats', '统计与签到'],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'info' && (
        <div className="panel salon-details-panel">
          <h2>{event.titleZh}</h2>
          <p>{event.summaryZh || '暂无简介'}</p>
          <p>
            举办时间：{new Date(event.starts).toLocaleString()} —{' '}
            {new Date(event.ends).toLocaleString()}
          </p>
          <p>
            地点：{event.locationZh || '—'} {event.addressZh || ''}
          </p>
          <p>主办方：{event.organizer || '—'}</p>
          <p>报名截止：{new Date(event.registrationEnds).toLocaleString()}</p>
        </div>
      )}
      {event.test && <p role="status" className="notice">测试活动：数据不纳入正式活动。</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {tab === 'stats' && (
        <>
          <div className="operation-metrics">
            {[
              ['累计报名', stats.total],
              ['有效报名', stats.valid],
              ['已取消', stats.cancelled],
              ['已签到', stats.checked],
              ['未签到', stats.unchecked],
              ['签到率', stats.rate === null ? '—' : stats.rate + '%'],
              ['剩余名额', stats.remaining ?? '不限'],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="muted">{l}</p>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <div className="panel salon-qr-summary">
            <div>
              <b>活动签到入口</b>
              <p className="muted">仅已报名用户登录后可签到。</p>
            </div>
            <button className="btn" onClick={() => setQrOpen(true)}>
              查看签到入口
            </button>
          </div>
        </>
      )}
      {qrOpen && (
        <Dialog open onOpenChange={setQrOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>活动签到入口</DialogTitle>
            </DialogHeader>
            <p>仅已报名用户登录后可签到，签到码不验证现场位置。</p>
            {qrImage?<img src={qrImage} alt="活动签到二维码" style={{width:220,height:220,margin:'0 auto'}}/>:<p role="status">{error||'正在加载签到码…'}</p>}
            <SiteLink
              className="btn"
              href={'/zh/events/' + event.id + '?checkin=' + event.checkinCode}
            >
              打开签到页面
            </SiteLink>
            <button aria-busy={Boolean(busy)}
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const data = await marketingApi('admin-qr', { id: event.id });
                  const a = document.createElement('a');
                  a.href = 'data:image/png;base64,' + data.png;
                  a.download = '活动签到码-' + event.id + '.png';
                  a.click();
                })
              }
            >
              下载签到二维码 PNG
            </button>
          </DialogContent>
        </Dialog>
      )}
      {tab === 'registrations' && (
        <>
          <div className="operation-filters">
            <Field
              label="搜索报名"
              placeholder="姓名 / 邮箱 / 电话 / 公司"
              value={filters.q}
              onChange={(q: string) => setFilters({ ...filters, q, page: 1 })}
            />
            <Field
              label="公司"
              value={filters.company}
              onChange={(company: string) =>
                setFilters({ ...filters, company, page: 1 })
              }
            />
            <Field
              label="报名时间起"
              type="datetime-local"
              value={
                filters.from
                  ? new Date(
                      Date.parse(filters.from) -
                        new Date(filters.from).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
              onChange={(v: string) =>
                setFilters({
                  ...filters,
                  from: v ? new Date(v).toISOString() : '',
                  page: 1,
                })
              }
            />
            <Field
              label="报名时间止（不含）"
              type="datetime-local"
              value={
                filters.to
                  ? new Date(
                      Date.parse(filters.to) -
                        new Date(filters.to).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
              onChange={(v: string) =>
                setFilters({
                  ...filters,
                  to: v ? new Date(v).toISOString() : '',
                  page: 1,
                })
              }
            />
            <Choice
              label="每页"
              value={String(filters.pageSize)}
              items={['20', '50', '100'].map((v) => [v, v + '条'])}
              onChange={(v: string) =>
                setFilters({ ...filters, pageSize: Number(v), page: 1 })
              }
            />
            <Choice
              label="报名状态"
              value={filters.status || 'all'}
              items={[
                ['all', '全部'],
                ['active', '有效'],
                ['cancelled', '取消'],
              ]}
              onChange={(v: string) =>
                setFilters({
                  ...filters,
                  status: v === 'all' ? '' : v,
                  page: 1,
                })
              }
            />
            <Choice
              label="签到状态"
              value={filters.checked || 'all'}
              items={[
                ['all', '全部'],
                ['yes', '已签到'],
                ['no', '未签到'],
              ]}
              onChange={(v: string) =>
                setFilters({
                  ...filters,
                  checked: v === 'all' ? '' : v,
                  page: 1,
                })
              }
            />
            <button aria-busy={Boolean(busy)}
              className="btn"
              hidden={!can('export')}
              disabled={busy}
              onClick={() => exportRows(true)}
            >
              导出筛选结果
            </button>
            <button aria-busy={Boolean(busy)}
              className="btn"
              hidden={!can('export')}
              disabled={busy || !selected.length}
              onClick={() => exportRows(false)}
            >
              导出所选
            </button>
          </div>
          <div className="list-batch">
            <label>
              <input
                type="checkbox"
                aria-label="全选当前页报名"
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
            <span>已选 {selected.length} 条</span>
          </div>
          <div className="panel">
            <Table className="list-table">
              <TableHeader>
                <TableRow>
                  {[
                    '选择',
                    '姓名',
                    '邮箱',
                    '报名时间',
                    '状态',
                    '签到时间',
                    '操作',
                  ].map((x) => (
                    <TableHead key={x}>{x}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={'选择' + r.name}
                        checked={selected.includes(r.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, r.id]
                              : selected.filter((id) => id !== r.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      {new Date(r.created).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {r.status === 'active' ? '有效' : '已取消'}
                    </TableCell>
                    <TableCell>
                      {r.checkedAt
                        ? new Date(r.checkedAt).toLocaleString()
                        : '未签到'}
                    </TableCell>
                    <TableCell>
                      <button
                        className="btn"
                        onClick={() => {
                          setRow(r);
                          setReason('');
                        }}
                      >
                        详情 / 处理
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager
              result={result}
              onPage={(page: number) => setFilters({ ...filters, page })}
            />
          </div>
        </>
      )}
      {tab === 'stats' && (
        <>
          <div className="field-grid">
            {[
              ['每日报名', 'registrationsByDay'],
              ['每日签到', 'checkinsByDay'],
            ].map(([label, key]) => (
              <div className="panel" key={key} style={{ padding: 20 }}>
                <h3>{label}</h3>
                {stats[key].length ? (
                  stats[key].map((p: any) => (
                    <p key={p.date}>
                      {p.date}　
                      <progress
                        value={p.count}
                        max={Math.max(...stats[key].map((x: any) => x.count))}
                      />
                      　{p.count} 人
                    </p>
                  ))
                ) : (
                  <p className="muted">暂无数据</p>
                )}
              </div>
            ))}
          </div>
          <div className="panel" style={{ padding: 20, marginTop: 20 }}>
            <h3>邮件通知</h3>
            {detail.mail.map((m: any) => (
              <span key={m.status} className="pill">
                {m.status}: {m.count}
              </span>
            ))}
            <button aria-busy={Boolean(busy)}
              className="btn"
              hidden={!can('manage')}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await marketingApi(
                    'admin-retry-mail',
                    { id: event.id },
                    true,
                  );
                  await onReload();
                })
              }
            >
              发送待发 / 重试失败邮件（每次1封）
            </button>
          </div>
          <div className="panel" style={{ padding: 20, marginTop: 20 }}>
            <h3>活动操作记录（最近100条）</h3>
            {detail.logs.map((l: any, i: number) => (
              <p key={i}>
                {new Date(l.created).toLocaleString()} · {l.actor} · {l.action}{' '}
                · {l.registration_id || '活动'} · {l.reason || '—'}
              </p>
            ))}
          </div>
        </>
      )}
      {row && (
        <Dialog open onOpenChange={(o) => !o && setRow(null)}>
          <DialogContent style={{ maxHeight: '85vh', overflow: 'auto' }}>
            <DialogHeader>
              <DialogTitle>报名详情</DialogTitle>
            </DialogHeader>
            {error && <p role="alert" className="error">{error}</p>}
            {row.fields.map((f: any) => (
              <p key={f.id}>
                <b>{f.labelZh}：</b>
                {f.type === 'image' && row.answers[f.id] ? (
                  <SiteLink href={row.answers[f.id]} target="_blank" rel="noreferrer">
                    查看图片
                  </SiteLink>
                ) : (
                  row.answers[f.id] || '—'
                )}
              </p>
            ))}
            <Field
              label="内部备注"
              multiline
              value={row.note}
              onChange={(note: string) => setRow({ ...row, note })}
            />
            <Field
              label="补签 / 撤销 / 取消原因"
              value={reason}
              onChange={setReason}
            />
            <div className="flex-actions">
              {[
                ['note', '保存备注'],
                ['checkin', '人工补签'],
                ['undo', '撤销签到'],
                ['cancel', '取消报名'],
              ]
                .filter(([op]) =>
                  can(['checkin', 'undo'].includes(op) ? 'checkin' : 'manage'),
                )
                .map(([op, l]) => (
                  <button aria-busy={Boolean(busy)}
                    className="btn"
                    key={op}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await marketingApi(
                          'admin-change-registration',
                          {
                            id: event.id,
                            registrationId: row.id,
                            operation: op,
                            note: row.note,
                            reason,
                          },
                          true,
                        );
                        setRow(null);
                        await reload();
                        await onReload();
                      })
                    }
                  >
                    {l}
                  </button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
