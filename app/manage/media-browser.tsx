'use client';
import { AdminPagination } from './admin-ui';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './admin-dialog';
import { mutate } from './shared';
export default function MediaBrowser({
  picker = false,
  accept = 'all',
  multiple = false,
  initialIds = [],
  max = 10,
  onSelect,
  onClose,
}: any) {
  const [type, setType] = useState(accept === 'all' ? 'image' : accept),
    [folder, setFolder] = useState('all'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [result, setResult] = useState<any>({
      rows: [],
      folders: [],
      counts: {},
      page: 1,
      pages: 1,
      total: 0,
    }),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(''),
    [selected, setSelected] = useState<any[]>(
      initialIds.map((id: string) => ({ id })),
    ),
    [preview, setPreview] = useState<any>(null);
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    fetch(
      '/api/assets?' +
        new URLSearchParams({ type, folder, q: query, page: String(page) }),
      { signal: c.signal },
    )
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        setResult(d);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setMessage(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [type, folder, query, page, version]);
  function filter(k: string, v: string) {
    if (k === 'type') setType(v);
    if (k === 'folder') setFolder(v);
    if (k === 'q') setQuery(v);
    setPage(1);
    if (!picker) setSelected([]);
  }
  function choose(a: any) {
    setMessage('');
    if (!multiple && picker) {
      setSelected([a]);
      return;
    }
    if (selected.some((s) => s.id === a.id)) {
      setSelected((s) => s.filter((v) => v.id !== a.id));
      return;
    }
    if (picker && selected.length >= max) {
      setMessage('最多选择 ' + max + ' 张');
      return;
    }
    setSelected((s) => [...s, a]);
  }
  async function action(name: string, id: string, data: any = {}) {
    setBusy(true);
    setMessage('');
    try {
      await mutate(name, { id, data });
      refresh();
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function folderEdit(f?: any) {
    const name = window.prompt('文件夹名称', f?.name || '');
    if (name?.trim())
      await action('saveFolder', f?.id || '', { id: f?.id, name: name.trim() });
  }
  async function batch(name: string, ids: string[], data: any = {}) {
    if (!ids.length) return;
    if (
      name === 'deleteAsset' &&
      !window.confirm(`确认删除 ${ids.length} 个素材？被引用的素材会跳过。`)
    )
      return;
    setBusy(true);
    const errors = [];
    let n = 0;
    for (const id of ids) {
      try {
        await mutate(name, { id, data });
        n++;
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    setSelected([]);
    setBusy(false);
    refresh();
    setMessage(
      `成功 ${n} 个${errors.length ? '；失败 ' + errors.length + ' 个：' + [...new Set(errors)].join('；') : ''}`,
    );
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setMessage('');
    const errors = [];
    let n = 0;
    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.set('file', file);
        const r = await fetch('/api/upload', { method: 'POST', body });
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        if (folder !== 'all' && folder !== 'none')
          await mutate('moveAsset', { id: d.id, data: { folderId: folder } });
        const asset = { id: d.id, name: file.name, mime: file.type };
        if (picker)
          setSelected((s: any[]) =>
            multiple ? (s.length < max ? [...s, asset] : s) : [asset],
          );
        n++;
      } catch (e) {
        errors.push(file.name + '：' + (e as Error).message);
      }
    }
    setBusy(false);
    setPage(1);
    refresh();
    setMessage(
      `上传成功 ${n} 个${errors.length ? '；' + errors.join('；') : ''}`,
    );
  }
  return (
    <div className={'media-browser ' + (picker ? 'picker-mode' : '')}>
      {picker && (
        <div className="media-picker-dropzone">
          <span>
            <strong>选择已有素材，或直接上传新素材</strong>
            上传成功后会自动选中，可直接确认使用。
          </span>
          <label className="btn primary">
            {busy ? '处理中…' : type === 'image' ? '上传图片' : '上传视频'}
            <input
              type="file"
              multiple
              hidden
              disabled={busy}
              accept={
                type === 'image'
                  ? 'image/png,image/jpeg,image/webp,image/gif'
                  : 'video/mp4,video/webm'
              }
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}
      <div className="media-toolbar">
        {accept === 'all' && (
          <>
            <button
              type="button"
              className={'btn ' + (type === 'image' ? 'primary' : '')}
              onClick={() => filter('type', 'image')}
            >
              图片库
            </button>
            <button
              type="button"
              className={'btn ' + (type === 'video' ? 'primary' : '')}
              onClick={() => filter('type', 'video')}
            >
              视频库
            </button>
          </>
        )}
        {!picker && (
          <label className="btn primary">
            {busy ? '处理中…' : type === 'image' ? '上传图片' : '上传视频'}
            <input
              type="file"
              multiple
              hidden
              disabled={busy}
              accept={
                type === 'image'
                  ? 'image/png,image/jpeg,image/webp,image/gif'
                  : 'video/mp4,video/webm'
              }
              onChange={(e) => {
                upload(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
        <input
          className="media-search"
          aria-label="搜索素材名称"
          placeholder="输入素材名称"
          value={query}
          maxLength={200}
          onChange={(e) => filter('q', e.target.value)}
        />
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="media-layout">
        <aside className="media-folders">
          {[
            ['all', '全部素材', result.counts.total],
            ['none', '未分组', result.counts.ungrouped],
            ...result.folders.map((f: any) => [f.id, f.name, f.count]),
          ].map(([id, name, count]) => (
            <div className={folder === id ? 'active' : ''} key={id}>
              <button onClick={() => filter('folder', id)}>
                {name}
                <span>{count || 0}</span>
              </button>
              {!['all', 'none'].includes(id) && (
                <div className="folder-tools">
                  <button aria-busy={Boolean(busy)}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      folderEdit(result.folders.find((f: any) => f.id === id))
                    }
                  >
                    改名
                  </button>
                  <button aria-busy={Boolean(busy)}
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        window.confirm(
                          '删除文件夹后素材移入未分组，确认删除？',
                        ) &&
                        (await action('deleteFolder', id))
                      ) {
                        setFolder('none');
                        setPage(1);
                      }
                    }}
                  >
                    删除
                  </button>
                </div>
              )}
            </div>
          ))}
          <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={() => folderEdit()}>
            ＋ 新增文件夹
          </button>
        </aside>
        <div className="media-content">

          {loading ? (
            <p className="empty-state">正在加载…</p>
          ) : (
            <div className="media-grid">
              {result.rows.map((a: any) => (
                <article
                  key={a.id}
                  className={
                    'media-card ' +
                    (selected.some((s) => s.id === a.id) ? 'selected' : '')
                  }
                >
                  <button
                    type="button"
                    className="media-picture"
                    onClick={() => choose(a)}
                    aria-pressed={selected.some((s) => s.id === a.id)}
                  >
                    {a.mime.startsWith('image') ? (
                      <img src={'/api/media/' + a.id} alt={a.name} />
                    ) : (
                      <video
                        muted
                        preload="metadata"
                        src={'/api/media/' + a.id}
                      />
                    )}
                    <span className="media-check">
                      {selected.some((s) => s.id === a.id) ? '✓' : '○'}
                    </span>
                  </button>
                  <p title={a.name}>{a.name}</p>
                  <div className="flex-actions">
                    <button onClick={() => setPreview(a)}>预览</button>
                    {!picker && (
                      <>
                        <button aria-busy={Boolean(busy)}
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            const name = window.prompt('素材名称', a.name);
                            if (name?.trim())
                              action('renameAsset', a.id, { name });
                          }}
                        >
                          改名
                        </button>
                        <button aria-busy={Boolean(busy)}
                          type="button"
                          disabled={busy}
                          onClick={() => batch('deleteAsset', [a.id])}
                        >
                          删除
                        </button>
                        <select
                          aria-label="移动到文件夹"
                          value={a.folder_id || ''}
                          disabled={busy}
                          onChange={(e) =>
                            action('moveAsset', a.id, {
                              folderId: e.target.value,
                            })
                          }
                        >
                          <option value="">未分组</option>
                          {result.folders.map((f: any) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && !result.rows.length && (
            <p className="empty-state">没有匹配素材</p>
          )}
        </div>
      </div>
      <div className="media-bottom">
        {!picker && (
          <>
            <button aria-busy={Boolean(loading)}
              type="button"
              className="btn"
              disabled={loading || busy}
              onClick={() =>
                setSelected(
                  result.rows.every((a: any) =>
                    selected.some((s) => s.id === a.id),
                  )
                    ? []
                    : result.rows,
                )
              }
            >
              本页全选 / 取消
            </button>
            <select
              aria-label="批量移动到文件夹"
              disabled={busy || !selected.length}
              value=""
              onChange={(e) => {
                if (e.target.value)
                  batch(
                    'moveAsset',
                    selected.map((a) => a.id),
                    {
                      folderId: e.target.value === 'none' ? '' : e.target.value,
                    },
                  );
              }}
            >
              <option value="">批量移动</option>
              <option value="none">未分组</option>
              {result.folders.map((f: any) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button aria-busy={Boolean(busy)}
              type="button"
              className="btn"
              disabled={busy || !selected.length}
              onClick={() =>
                batch(
                  'deleteAsset',
                  selected.map((a) => a.id),
                )
              }
            >
              批量删除
            </button>
          </>
        )}
        <AdminPagination page={result.page} pages={result.pages} total={result.total} busy={loading} onPage={next=>{setPage(next);if(!picker)setSelected([]);}} />
        {picker && (
          <div className="picker-confirm-actions">
            <button aria-busy={Boolean(busy)}
              type="button"
              className="btn"
              disabled={busy || !selected.length}
              onClick={() => setSelected([])}
            >
              清空已选
            </button>
            <span>
              已选 {selected.length}
              {multiple ? ' / ' + max : ''}
            </span>
            <button aria-busy={Boolean(busy)}
              type="button"
              className="btn"
              disabled={busy}
              onClick={onClose}
            >
              取消
            </button>
            <button aria-busy={Boolean(busy)}
              type="button"
              className="btn primary"
              disabled={busy || !selected.length}
              onClick={() => onSelect(multiple ? selected : selected[0])}
            >
              确定
            </button>
          </div>
        )}
      </div>
      {preview && (
        <Dialog open onOpenChange={(v) => !v && setPreview(null)}>
          <DialogContent size="lg" className="media-preview-dialog">
            <DialogHeader>
              <DialogTitle>素材预览</DialogTitle>
            </DialogHeader>
            <button className="btn" onClick={() => setPreview(null)}>
              关闭预览
            </button>
            {preview.mime.startsWith('image') ? (
              <img src={'/api/media/' + preview.id} alt={preview.name} />
            ) : (
              <video controls src={'/api/media/' + preview.id} />
            )}
            <p>{preview.name}</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
