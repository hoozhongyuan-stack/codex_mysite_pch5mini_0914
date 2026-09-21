'use client';
import SiteLink from '../../components/site-link';

import { formatMoney } from '@/lib/product-options.mjs';
import VisitorProfile, { sourceLabels } from './visitor-profile';
import { useState } from 'react';
import {
  Dialog,
  AdminFormActions,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './admin-dialog';
import {
  useList,
  Filters,
  Pager,
  ListState,
  useSelection,
  SelectAll,
  Filter,
} from './list-ui';
import { mutate } from './shared';
import { actionLabels } from '@/lib/list-domain.mjs';
const states: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  done: '已完成',
};
const stamp = (value: string) =>
  value ? new Date(value).toLocaleString('zh-CN') : '—';
export default function Records({ kind, data }: any) {
  const list = useList(
      kind === 'users'
        ? '/api/identity-admin/users'
        : '/api/admin/list?kind=' + kind,
    ),
    selection = useSelection(
      list.query + JSON.stringify(list.result.rows.map((r: any) => r.id)),
    );
  const [detail, setDetail] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const rows = list.result.rows,
    isSub = kind === 'submissions',
    isUser = kind === 'users';
  const filters: Filter[] = isSub
    ? [
        { key: 'q', label: '姓名 / 邮箱' },
        {
          key: 'form',
          label: '所属表单',
          options: [
            ['', '全部'],
            ...(data.contents
              .filter((r: any) => r.kind === 'forms')
              .map((r: any) => [r.id, r.titleZh]) as [string, string][]),
          ],
        },
        {
          key: 'status',
          label: '处理状态',
          options: [['', '全部'], ...Object.entries(states)],
        },
      ]
    : isUser
      ? [
          { key: 'q', label: '姓名 / 邮箱 / 手机尾号' },
          { key: 'country', label: '国家代码' },
          { key: 'city', label: '城市' },
          { key: 'company', label: '公司名称' },
          {
            key: 'source',
            label: '注册来源',
            options: [['', '全部'], ...Object.entries(sourceLabels).filter(([key]) => !key.startsWith('sandbox:'))],
          },
          {
            key: 'verified',
            label: '邮箱验证',
            options: [
              ['', '全部'],
              ['true', '已验证'],
              ['false', '未验证'],
            ],
          },
          { key: 'phoneVerified', label: '手机号授权', options: [['', '全部'], ['true', '已授权'], ['false', '未授权']] },
          { key: 'phoneReviewStatus', label: '手机号审核', options: [['', '全部'], ['unreviewed', '待审核'], ['approved', '已确认'], ['follow_up', '需跟进'], ['not_authorized', '未授权']] },
          {
            key: 'enabled',
            label: '账号状态',
            options: [
              ['', '全部'],
              ['true', '启用'],
              ['false', '停用'],
            ],
          },
        ]
      : [
          { key: 'actor', label: '操作人邮箱' },
          {
            key: 'action',
            label: '操作类型',
            options: [['', '全部'], ...Object.entries(actionLabels)],
          },
          {
            key: 'module',
            label: '所属模块',
            options: [
              ['', '全部'],
              ['content', '内容'],
              ['categories', '分类'],
              ['assets', '素材'],
              ['navigation', '导航'],
              ['admins', '管理员'],
              ['policies', '政策'],
              ['settings', '设置'],
              ['submissions', '表单提交'],
              ['geo', 'GEO'],
              ['users', '访客'],
            ],
          },
        ];
  async function open(row: any) {
    setMessage('');
    if (!isSub) {
      setDetail(row);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(
        '/api/admin/submission?id=' + encodeURIComponent(row.id),
      );
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setDetail({ ...d, formTitle: row.formTitle });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(records: any[], value: string, note = '') {
    if (
      isUser &&
      value === 'false' &&
      !window.confirm(
        `确认停用 ${records.length} 个访客账号？已登录会话将失效。`,
      )
    )
      return;
    setBusy(true);
    let count = 0;
    const errors = [];
    for (const r of records) {
      try {
        if (isSub)
          await mutate('updateSubmission', {
            id: r.id,
            data: { status: value, note },
          });
        else {
          const response = await fetch('/api/identity-admin/set-user-enabled', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r.id, enabled: value === 'true' }),
          });
          const d: any = await response.json();
          if (!response.ok) throw Error(d.error);
          if (d.warning) errors.push(`${r.email}：${d.warning}`);
        }
        count++;
      } catch (e) {
        errors.push(`${r.email || r.id}：${(e as Error).message}`);
      }
    }
    selection.clear();
    await list.reload();
    setMessage(
      `成功 ${count} 条${errors.length ? '；失败 ' + errors.length + ' 条\n' + errors.join('\n') : ''}`,
    );
    setBusy(false);
    if (!errors.length) setDetail(null);
  }
  async function exportRows() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selection.selected }),
      });
      if (!r.ok) throw Error(((await r.json()) as any).error);
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = '表单提交.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`已导出 ${selection.selected.length} 条提交`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {new URLSearchParams(list.query).get('dashboard')==='1'&&<p role="status" className="notice">来自统计总览：中国时区 {new URLSearchParams(list.query).get('start')} 至 {new URLSearchParams(list.query).get('end')}（截止不含）。<SiteLink href={'/admin?view='+kind}>清除统计筛选</SiteLink></p>}
      <div className="heading-row">
        <div>
          <h1>{isSub ? '表单列表' : isUser ? '访客用户' : '操作日志'}</h1>
          <p className="muted">
            {isSub
              ? '查看访客提交，跟进处理进度。'
              : isUser
                ? '手机号仅显示脱敏号码；授权资料不可在后台修改或导出。'
                : '只读审计记录；不展示密码、授权码或提交内容。'}
          </p>
        </div>
      </div>
      <section className="panel">
        <Filters list={list} fields={filters} />
        {(isSub || isUser) && (
          <div className="list-batch">
            <span>已选 {selection.selected.length} 条（当前页）</span>
            {(isSub
              ? Object.entries(states)
              : [
                  ['true', '启用'],
                  ['false', '停用'],
                ]
            ).map(([v, l]) => (
              <button aria-busy={Boolean(busy)}
                className="btn"
                key={v}
                disabled={busy || list.loading || !selection.selected.length}
                onClick={() =>
                  update(
                    rows.filter((r: any) =>
                      selection.selected.includes(String(r.id)),
                    ),
                    v,
                  )
                }
              >
                批量{l}
              </button>
            ))}
            {isSub && (
              <button aria-busy={Boolean(busy)}
                className="btn"
                disabled={busy || list.loading || !selection.selected.length}
                onClick={exportRows}
              >
                导出所选
              </button>
            )}
          </div>
        )}
        <div className="list-table-wrap">
          <table aria-busy={list.loading} inert={list.loading} className="list-table">
            <thead>
              <tr>
                {(isSub || isUser) && (
                  <th>
                    <SelectAll selection={selection} rows={rows} />
                  </th>
                )}
                {(isSub
                  ? [
                      '所属表单',
                      '姓名',
                      '邮箱',
                      '处理状态',
                      '阅读状态',
                      '提交时间',
                    ]
                  : isUser
                    ? ['姓名', '邮箱', '手机号', '授权状态', '账号状态', '注册时间']
                    : ['操作人', '操作类型', '对象', '记录时间']
                ).map((h) => (
                  <th key={h}>{h}</th>
                ))}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                  <tr key={r.id}>
                    {(isSub || isUser) && (
                      <td>
                        <input
                          aria-label={'选择 ' + (r.email || r.id)}
                          type="checkbox"
                          checked={selection.selected.includes(String(r.id))}
                          onChange={() => selection.toggle(String(r.id))}
                        />
                      </td>
                    )}
                    {isSub ? (
                      <>
                        <td>
                          {r.formTitle || '表单已移除'}
                          <small className="muted">{r.form_id}</small>
                          {r.source && (
                            <small className="muted">
                              来源：{r.source.titleZh}
                            </small>
                          )}
                        </td>
                        <td>
                          {r.name === '表单访客'
                            ? '未提供'
                            : r.name || '未提供'}
                        </td>
                        <td>{r.email || '未提供'}</td>
                        <td>
                          <span className="pill">
                            {states[r.processingStatus]}
                          </span>
                        </td>
                        <td>{r.status === 'read' ? '已读' : '未读'}</td>
                        <td>{stamp(r.created_at)}</td>
                      </>
                    ) : isUser ? (
                      <>
                        <td>
                          {r.lastName} {r.firstName}
                        </td>
                        <td>
                          {r.email}
                          {isUser && (
                            <small className="muted">
                              {sourceLabels[r.registrationSource] ||
                                r.registrationSource}{' '}
                              · {r.country || '国家未设置'}
                              {r.city ? ' / ' + r.city : ''}
                              {r.company && (
                                <>
                                  <br />
                                  {r.company}
                                </>
                              )}
                            </small>
                          )}
                        </td>
                        <td>{r.phoneMasked || '—'}</td>
                        <td>{r.phoneVerified ? '已授权' : '未授权'}<small className="muted">{r.phoneReviewStatus === 'approved' ? ' · 已确认' : r.phoneReviewStatus === 'follow_up' ? ' · 需跟进' : r.phoneReviewStatus === 'unreviewed' ? ' · 待审核' : ''}</small></td>
                        <td>
                          <span
                            className={'pill ' + (r.enabled ? 'green' : 'gray')}
                          >
                            {r.enabled ? '启用' : '停用'}
                          </span>
                        </td>
                        <td>{stamp(r.created_at)}</td>
                      </>
                    ) : (
                      <>
                        <td>{r.actor}</td>
                        <td>{(actionLabels as any)[r.action] || r.action}</td>
                        <td>{r.target || '—'}</td>
                        <td>{stamp(r.created_at)}</td>
                      </>
                    )}
                    <td>
                      <div className="flex-actions">
                        <button aria-busy={Boolean(busy)}
                          className="btn"
                          disabled={busy}
                          onClick={() => open(r)}
                        >
                          详情
                        </button>
                        {isUser && (
                          <button aria-busy={Boolean(busy)}
                            className="btn"
                            disabled={busy}
                            onClick={() => update([r], String(!r.enabled))}
                          >
                            {r.enabled ? '停用' : '启用'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <ListState list={list} />
        <Pager list={list} />
      </section>
      {message && (
        <p role="status" className="notice" style={{ whiteSpace: 'pre-wrap' }}>
          {message}
        </p>
      )}
      {detail && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v && !busy) setDetail(null);
          }}
        >
          <DialogContent className="record-dialog">
            {message && (
              <p
                className="notice"
                role="status"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {message}
              </p>
            )}
            <DialogHeader>
              <DialogTitle>
                {isSub ? '提交详情' : isUser ? '访客详情' : '日志详情'}
              </DialogTitle>
              <DialogDescription>
                {isSub
                  ? '提交内容为用户提交时的记录，备注仅后台可见。'
                  : '查看记录及相关信息。'}
              </DialogDescription>
            </DialogHeader>
            {isSub ? (
              <>
                <p>
                  {detail.formTitle || '表单已移除'} ·{' '}
                  {stamp(detail.created_at)}
                </p>
                {detail.source && (
                  <p role="status" className="notice">
                    来源：{detail.source.kind === 'articles' ? '文章' : '商品'}{' '}
                    · {detail.source.titleZh}（/{detail.source.kind}/
                    {detail.source.slug}）
                  </p>
                )}
                {detail.source?.product && (
                  <div role="status" className="notice">
                    <b>咨询时商品信息</b>
                    <p>SPU：{detail.source.product.spu || '未设置'}</p>
                    <p>
                      {detail.source.product.specs
                        .map((s: any) => s.nameZh + '：' + s.valueZh)
                        .join(' / ') || '默认商品（无规格）'}
                    </p>
                    <p>
                      价格：
                      {formatMoney(
                        detail.source.product.priceMinor,
                        detail.source.product.currency,
                      )}{' '}
                      · {detail.source.product.currency}
                    </p>
                    <p>
                      库存：
                      {detail.source.product.inventoryDisplay === 'hidden'
                        ? '未展示'
                        : detail.source.product.stockStatus === null
                          ? '未设置'
                          : detail.source.product.stockStatus === 'out'
                            ? '暂时缺货'
                            : detail.source.product.inventory !== null
                              ? detail.source.product.inventory + ' 件'
                              : '有库存'}
                    </p>
                  </div>
                )}
                <div className="record-values">
                  {detail.fields ? (
                    detail.fields.map((f: any) => (
                      <div key={f.id}>
                        <b>{f.labelZh}</b>
                        <p>
                          {f.type === 'image' && detail.values?.[f.id] ? (
                            <SiteLink
                              target="_blank"
                              rel="noreferrer"
                              className="title-link"
                              href={
                                '/api/submission-file/' +
                                encodeURIComponent(detail.values[f.id])
                              }
                            >
                              查看图片 ↗
                            </SiteLink>
                          ) : (
                            String(detail.values?.[f.id] ?? '未提供')
                          )}
                        </p>
                      </div>
                    ))
                  ) : (
                    <>
                      <p>
                        {detail.name} · {detail.email}
                      </p>
                      <p>{detail.message}</p>
                    </>
                  )}
                </div>
                <button aria-busy={Boolean(busy)}
                  className="btn"
                  disabled={busy || detail.status === 'read'}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await mutate('markSubmission', { id: detail.id });
                      setDetail({ ...detail, status: 'read' });
                      await list.reload();
                    } catch (e) {
                      setMessage((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {detail.status === 'read' ? '已读' : '标为已读'}
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const d = new FormData(e.currentTarget);
                    update(
                      [detail],
                      String(d.get('status')),
                      String(d.get('note') || ''),
                    );
                  }}
                >
                  <label className="field">
                    <span>处理状态</span>
                    <select
                      name="status"
                      defaultValue={detail.processingStatus}
                    >
                      {Object.entries(states).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>新增内部备注</span>
                    <textarea name="note" maxLength={2000} rows={3} />
                  </label>
                  <AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
                    保存处理记录
                  </button></AdminFormActions>
                </form>
                <h3>处理历史</h3>
                {detail.history.length ? (
                  detail.history.map((h: any) => (
                    <div className="record-history" key={h.id}>
                      <b>{states[h.status]}</b> · {h.actor} ·{' '}
                      {stamp(h.created_at)}
                      <p>{h.note || '无备注'}</p>
                    </div>
                  ))
                ) : (
                  <p className="muted">暂无处理记录</p>
                )}
              </>
            ) : isUser ? (
              <>
                <VisitorProfile
                  user={detail}
                  onSaved={(u: any) => {
                    setDetail(u);
                    list.reload();
                  }}
                />
                <dl className="record-values">
                  {[
                    ['姓', detail.lastName],
                    ['名', detail.firstName],
                    ['邮箱', detail.email],
                    ['邮箱验证', detail.verified ? '已验证' : '未验证'],
                    ['账号状态', detail.enabled ? '启用' : '停用'],
                    ['注册时间', stamp(detail.created_at)],
                    ['最近登录', stamp(detail.lastLogin)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <dl className="record-values">
                {[
                  ['编号', detail.id],
                  ['操作人', detail.actor],
                  [
                    '操作',
                    (actionLabels as any)[detail.action] || detail.action,
                  ],
                  ['对象', detail.target],
                  ['时间', stamp(detail.created_at)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
