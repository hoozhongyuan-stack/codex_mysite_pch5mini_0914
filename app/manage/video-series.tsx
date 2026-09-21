'use client';
import SiteLink from '../../components/site-link';

import { useState, useEffect } from 'react';
import RichEditor from './rich-editor';
import { useAdminDetail } from './admin-navigation';
import { AdminDetailState, AdminPageHeader } from './admin-ui';
import {displayVideoBody} from '@/lib/video-body.mjs';
import './marketing-workspace.css';
import VideoSourcePicker from './video-source-picker';
import { Film, ArrowLeft, Plus, Upload, Play } from 'lucide-react';
import { Field, Choice } from './shared';
import AssetPicker from './asset-picker';
import {
  Dialog,
  AdminFormActions,
  useDialogChangeRevision,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './admin-dialog';
export async function videoApi(action: string, data: any = {}, post = false) {
  const r = await fetch(
    '/api/video/' + action + (post ? '' : '?' + new URLSearchParams(data)),
    post
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : { cache: 'no-store' },
  );
  const d = (await r.json()) as any;
  if (!r.ok) throw Error(d.error || '请求失败');
  return d;
}
const status = [
  ['draft', '草稿'],
  ['published', '已发布'],
  ['archived', '已下架'],
];
const jobNames: any = {
  queued: '排队中',
  processing: '转码中',
  ready: '处理完成',
  failed: '处理失败',
};
export default function VideoSeries({ data }: any) {
  const [result, setResult] = useState<any>({ rows: [], pages: 1 }),
    [filters, setFilters] = useState({ q: '', status: '', type: '', page: 1 }),
    [edit, setEdit] = useState<any>(null),
    [picker, setPicker] = useState(false),
    [sourcePicker, setSourcePicker] = useState(false),
    [savedNotice, setSavedNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const detailRoute = useAdminDetail<any>('series', id => videoApi('admin-detail', {id}));
  const detail = detailRoute.value;
  const setDetail = detailRoute.setValue;
  const reload = async (id = detail?.series.id) => {
    if (id) setDetail(await videoApi('admin-detail', { id }));
    else setResult(await videoApi('admin-list', filters));
  };
  useEffect(() => {
    reload(null).catch((e) => setError(e.message));
  }, [filters]);
  useEffect(() => {
    if (!detail) return;
    const t = setInterval(
      () => reload().catch((e) => setError(e.message)),
      5000,
    );
    return () => clearInterval(t);
  }, [detail?.series.id]);
  const run = async (fn: () => Promise<any>) => {
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
  const [editRevision, markEdited] = useDialogChangeRevision();
  const set = (k: string, v: any) => { markEdited(); setEdit((e: any) => ({ ...e, [k]: v })); };
  const openEdit = (value: any) => {
    setError('');
    setSavedNotice('');
    setEdit(value);
  };
  const newItem = (episode = false) =>
    openEdit({
      episode,
      titleZh: '',
      titleEn: '',
      summaryZh: '',
      summaryEn: '',
      bodyZh: '',
      bodyEn: '',
      status: 'draft',
      type: 'course',
      sort: episode ? (detail?.episodes.length || 0) + 1 : 0,
      preview: false,
      seriesId: detail?.series.id,
    });
  if (detailRoute.loading || detailRoute.error) return <AdminDetailState loading={detailRoute.loading} error={detailRoute.error} onBack={detailRoute.close} onRetry={detailRoute.retry}/>;
  return (
    <section className="video-admin">
      <AdminPageHeader title={detail ? detail.series.titleZh : '视频专栏'} onBack={detail ? detailRoute.close : undefined} backLabel="返回系列" actions={<button className="btn primary" onClick={() => newItem(!!detail)}><Plus size={16}/>{detail ? '新增视频' : '新建系列'}</button>}/>
      <details className="admin-help"><summary>上传要求与播放说明</summary>
      <p role="status" className="notice">
        视频保存在私有目录，上传后由 FFmpeg
        处理。仅支持视频，不支持配套附件。受保护播放提高复制门槛，无法杜绝录屏。单文件最大
        1 GB，最长 4 小时。
      </p>
      </details>
      {savedNotice && (
        <p className="notice" role="status">
          {savedNotice}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!detail ? (
        <>
          <form
            className="admin-filter-bar"
            onSubmit={(e) => {
              e.preventDefault();
              reload(null);
            }}
          >
            <Field
              label="系列名称"
              value={filters.q}
              onChange={(q: string) => setFilters({ ...filters, q, page: 1 })}
            />
            <Choice
              label="状态"
              value={filters.status}
              items={[['', '全部状态'], ...status]}
              onChange={(v: string) =>
                setFilters({ ...filters, status: v, page: 1 })
              }
            />
            <Choice
              label="类型"
              value={filters.type}
              items={[
                ['', '全部类型'],
                ['course', '课程'],
                ['drama', '短剧'],
                ['other', '其他'],
              ]}
              onChange={(v: string) =>
                setFilters({ ...filters, type: v, page: 1 })
              }
            />
          </form>
          <div className="panel">
            <table className="video-table">
              <thead>
                <tr>
                  <th>系列</th>
                  <th>状态</th>
                  <th>已发布视频</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <div className="video-title-cell">
                        {s.imageId ? (
                          <img
                            className="video-table-thumb"
                            src={'/api/media/' + s.imageId}
                            alt={s.titleZh}
                          />
                        ) : (
                          <span className="video-table-thumb empty">
                            <Film size={24} />
                          </span>
                        )}
                        <b>{s.titleZh}</b>
                      </div>
                      <small>{s.titleEn}</small>
                    </td>
                    <td>{status.find((x) => x[0] === s.status)?.[1]}</td>
                    <td>{s.episodes}</td>
                    <td>
                      <div className="flex-actions">
                        <button
                          className="btn"
                          onClick={() => detailRoute.open(s.id)}
                        >
                          视频与统计
                        </button>
                        <button
                          className="btn"
                          onClick={() => openEdit({ ...s })}
                        >
                          编辑
                        </button>
                        <SiteLink className="btn" href={'/zh/videos/' + s.id}>
                          前台
                        </SiteLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!result.rows.length && (
              <p className="muted">暂无系列，点击“新建系列”开始。</p>
            )}
            <div className="flex-actions">
              <span>
                共 {result.total || 0} 项 · {result.page || 1}/{result.pages} 页
              </span>
              <button
                className="btn"
                disabled={filters.page <= 1}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page - 1 })
                }
              >
                上一页
              </button>
              <button
                className="btn"
                disabled={filters.page >= result.pages}
                onClick={() =>
                  setFilters({ ...filters, page: filters.page + 1 })
                }
              >
                下一页
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="panel">
            <table className="video-table">
              <thead>
                <tr>
                  <th>集数 / 名称</th>
                  <th>发布与处理状态</th>
                  <th>播放 / 观众 / 完成</th>
                  <th>有效观看</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {detail.episodes.map((ep: any) => {
                  const st = detail.stats.find((s: any) => s.id === ep.id);
                  return (
                    <tr key={ep.id}>
                      <td>
                        <div className="video-title-cell">
                          {ep.imageId ? (
                            <img
                              className="video-table-thumb"
                              src={'/api/media/' + ep.imageId}
                              alt={ep.titleZh}
                            />
                          ) : (
                            <span className="video-table-thumb empty">
                              <Film size={24} />
                            </span>
                          )}
                          <b>
                            {ep.sort}. {ep.titleZh}
                          </b>
                        </div>
                        <small>
                          {ep.preview ? '公开试看' : '登录观看'} ·{' '}
                          {Math.round(ep.duration)} 秒
                        </small>
                      </td>
                      <td>
                        {status.find((x) => x[0] === ep.status)?.[1]}
                        <small>
                          {jobNames[ep.job?.status] || '待上传'}
                          {ep.job?.error && (
                            <span role="alert" className="error">{ep.job.error}</span>
                          )}
                        </small>
                      </td>
                      <td>
                        {st.plays} / {st.viewers} / {st.completed}
                        <small>
                          完播率{' '}
                          {st.viewers
                            ? Math.round((st.completed / st.viewers) * 100)
                            : 0}
                          %
                        </small>
                      </td>
                      <td>{Math.round(st.seconds / 60)} 分钟</td>
                      <td>
                        <div className="flex-actions">
                          <button
                            className="btn"
                            onClick={() => openEdit({ ...ep, episode: true })}
                          >
                            编辑
                          </button>
                          <button aria-busy={Boolean(busy)}
                            className="btn"
                            disabled={
                              busy ||
                              ['queued', 'processing'].includes(ep.job?.status)
                            }
                            onClick={() => {
                              openEdit({ ...ep, episode: true });
                              setSourcePicker(true);
                            }}
                          >
                            {ep.ready ? '更换素材' : '关联视频'}
                          </button>
                          {ep.job?.status === 'failed' && (
                            <button
                              className="btn"
                              onClick={() =>
                                run(async () => {
                                  await videoApi(
                                    'admin-retry',
                                    { id: ep.job.id },
                                    true,
                                  );
                                  await reload();
                                })
                              }
                            >
                              重试
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!detail.episodes.length && (
              <p>先新增视频，再上传文件。处理完成后可以发布。</p>
            )}
          </div>
          <p className="muted">
            播放次数按授权会话计；观众按账号或匿名浏览器统计。有效观看时间以播放器进度与服务端时间校验，完成表示累计有效观看达到90%。
          </p>
          <details className="panel">
            <summary>最近播放异常记录</summary>
            {detail.security.map((s: any, i: number) => (
              <p key={i}>
                {new Date(s.created).toLocaleString()} · {s.reason}
              </p>
            ))}
          </details>
        </>
      )}
      {edit && (
        <Dialog changeRevision={editRevision} open onOpenChange={(o) => !o && !busy && setEdit(null)}>
          <DialogContent
            size="lg"
          >
            <DialogHeader>
              <DialogTitle>
                {edit.episode ? '视频信息' : '系列信息'}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await videoApi(
                    edit.episode ? 'admin-save-episode' : 'admin-save-series',
                    edit,
                    true,
                  );
                  setSavedNotice(
                    edit.sourceId
                      ? '已保存视频关联，处理状态请查看列表。'
                      : '已保存',
                  );
                  setEdit(null);
                  await reload();
                });
              }}
            >
              <fieldset disabled={busy}>
                {edit.episode && (
                  <div className="episode-file-field">
                    <h3>关联视频文件</h3>
                    <p className="muted">
                      {edit.ready
                        ? '已有关联视频。选择新文件可替换，转码成功前保留旧版本。'
                        : '从弹窗选择已有视频素材，保存后关联并转码。转码完成后再发布。'}
                    </p>
                    <button aria-busy={Boolean(busy)}
                      className="btn"
                      type="button"
                      disabled={
                        busy ||
                        ['queued', 'processing'].includes(edit.job?.status)
                      }
                      onClick={() => setSourcePicker(true)}
                    >
                      从素材库选择视频
                    </button>
                    {edit.sourceName && (
                      <p role="status">已选素材：{edit.sourceName}</p>
                    )}
                    {edit.job && (
                      <p>
                        处理状态：{jobNames[edit.job.status]} {edit.job.error}
                      </p>
                    )}
                    <small>
                      支持 MP4 / WebM / MOV，单文件最大 1
                      GB。未选择素材时可先保存草稿。
                    </small>
                  </div>
                )}
                <div className="field-grid">
                  {[
                    ['titleZh', '中文标题'],
                    ['titleEn', '英文标题'],
                    ['summaryZh', '中文简介'],
                    ['summaryEn', '英文简介'],
                  ].map(([k, l]) => (
                    <Field
                      key={k}
                      label={l}
                      value={edit[k]}
                      required={k.startsWith('title')}
                      onChange={(v: string) => set(k, v)}
                    />
                  ))}
                  <Field
                    label="排序（小值在前）"
                    type="number"
                    value={edit.sort}
                    onChange={(v: string) => set('sort', Number(v))}
                  />
                  <Choice
                    label="状态"
                    value={edit.status}
                    items={
                      edit.episode && !edit.ready
                        ? status.filter((x) => x[0] !== 'published')
                        : status
                    }
                    onChange={(v: string) => set('status', v)}
                  />
                </div>
                {edit.episode ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={!!edit.preview}
                      onChange={(e) => set('preview', e.target.checked)}
                    />
                    允许未登录用户试看本集
                  </label>
                ) : (
                  <>
                    <Choice
                      label="系列类型"
                      value={edit.type}
                      items={[
                        ['course', '课程'],
                        ['drama', '短剧'],
                        ['other', '其他'],
                      ]}
                      onChange={(v: string) => set('type', v)}
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={!!edit.finished}
                        onChange={(e) => set('finished', e.target.checked)}
                      />
                      系列已完结
                    </label>
                  </>
                )}
                <div className="video-cover-field">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setPicker(true)}
                  >
                    {edit.episode ? '选择本集封面' : '选择系列封面'}
                  </button>
                  {edit.imageId ? (
                    <img
                      className="video-table-thumb"
                      src={'/api/media/' + edit.imageId}
                      alt="已选封面"
                    />
                  ) : (
                    <span className="muted">暂未设置封面</span>
                  )}
                </div>
                {[
                  ['bodyZh', '中文详情'],
                  ['bodyEn', '英文详情'],
                ].map(([k, l]) => (
                  <div key={k} className="video-rich-field">
                    <h3>{l}</h3>
                    <RichEditor value={displayVideoBody(edit[k])} onChange={(value: any) => set(k, value)} assets={data.assets} folders={data.folders}/>
                  </div>
                ))}
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
                  {busy
                    ? '保存中…'
                    : edit.episode && !edit.ready
                      ? '保存草稿'
                      : '保存'}
                </button></AdminFormActions>
              </fieldset>
            </form>
            {sourcePicker && (
              <VideoSourcePicker
                data={data}
                onSelect={(source: any) => {
                  markEdited();
                  setEdit((e: any) => ({
                    ...e,
                    sourceId: source.id,
                    sourceName: source.name,
                  }));
                  setSourcePicker(false);
                }}
                onClose={() => setSourcePicker(false)}
              />
            )}
            {picker && (
              <AssetPicker
                accept="image"
                assets={data.assets}
                folders={data.folders}
                onSelect={(a: any) => {
                  set('imageId', a.id);
                  setPicker(false);
                }}
                onClose={() => setPicker(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
