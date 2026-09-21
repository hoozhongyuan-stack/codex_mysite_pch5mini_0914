'use client';
import { useEffect, useState } from 'react';
import SourceThumbnail, {sourcePreviewUrl} from './source-thumbnail';
import './video-library.css';
import { validateVideoSource } from '@/lib/video-editor.mjs';
import { Upload, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './admin-dialog';
async function request(action: string, data: any = {}, post = false) {
  const r = await fetch(
    '/api/video/admin-' +
      action +
      (post ? '' : '?' + new URLSearchParams(data)),
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
export function VideoSourceLibrary({ data, onSelect, onClose, onBusy }: any) {
  const [result, setResult] = useState<any>({ rows: [], pages: 1 }),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [folder, setFolder] = useState(''),
    [selected, setSelected] = useState<any>(null),
    [preview,setPreview] = useState<any>(null),
    [uploadTab, setUploadTab] = useState(false),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState('');
  useEffect(() => {
    onBusy?.(busy);
  }, [busy]);
  const reload = () =>
    request('library', { page, q: query, folder })
      .then(setResult)
      .catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, [page, query, folder]);
  const upload = async (file: File) => {
    try {
      validateVideoSource(file);
    } catch (e: any) {
      setError(e.message);
      return;
    }
    setBusy(true);
    setError('');
    setProgress(0);
    let id = '';
    try {
      const src = await request(
        'source-init',
        {
          name: file.name,
          size: file.size,
          folder: folder === 'unfiled' ? '' : folder,
        },
        true,
      );
      id = src.id;
      for (let offset = 0; offset < file.size; offset += 8 * 1024 * 1024) {
        const r = await fetch(
          '/api/video/source-chunk?' +
            new URLSearchParams({ id, offset: String(offset) }),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file.slice(offset, offset + 8 * 1024 * 1024),
          },
        );
        if (!r.ok) {
          const d = (await r.json()) as any;
          throw Error(d.error || '上传失败');
        }
        setProgress(
          Math.round(
            (Math.min(file.size, offset + 8 * 1024 * 1024) / file.size) * 100,
          ),
        );
      }
      const ready = await request('source-complete', { id }, true);
      setSelected(ready);
      setUploadTab(false);
      setQuery('');
      setPage(1);
      await reload();
    } catch (e: any) {
      setError(e.message);
      if (id) await request('source-cancel', { id }, true).catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  const legacy = (data?.assets || []).filter(
    (a: any) =>
      (a.mime || '').startsWith('video/') && (!query || a.name.includes(query)),
  );
  return (
    <div className="video-library">
      <div className="flex-actions">
        <button aria-busy={Boolean(busy)}
          className={'btn ' + (!uploadTab ? 'primary' : '')}
          disabled={busy}
          onClick={() => setUploadTab(false)}
        >
          视频素材库
        </button>
        <button aria-busy={Boolean(busy)}
          className={'btn ' + (uploadTab ? 'primary' : '')}
          disabled={busy}
          onClick={() => setUploadTab(true)}
        >
          上传新素材
        </button>
        <input
          aria-label="搜索视频素材"
          placeholder="搜索视频名称"
          disabled={busy}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview&&<Dialog open onOpenChange={open=>!open&&setPreview(null)}>
        <DialogContent size="lg" className="source-preview-dialog"><DialogHeader><DialogTitle>{preview.name}</DialogTitle><DialogDescription>私有视频预览</DialogDescription></DialogHeader>
          <video key={preview.id} controls playsInline preload="metadata" src={sourcePreviewUrl(preview.id)} onError={()=>setError('此视频暂无法播放，请检查素材格式或稍后重试')}/>
        </DialogContent>
      </Dialog>}
      <div className="video-library-layout">
        <aside>
          <button aria-busy={Boolean(busy)}
            className={!folder ? 'active' : ''}
            disabled={busy}
            onClick={() => {
              setFolder('');
              setPage(1);
            }}
          >
            全部素材
          </button>
          <button aria-busy={Boolean(busy)}
            className={folder === 'unfiled' ? 'active' : ''}
            disabled={busy}
            onClick={() => {
              setFolder('unfiled');
              setPage(1);
            }}
          >
            未分组
          </button>
          {(data?.folders || []).map((f: any) => (
            <button aria-busy={Boolean(busy)}
              key={f.id}
              className={folder === f.id ? 'active' : ''}
              disabled={busy}
              onClick={() => {
                setFolder(f.id);
                setPage(1);
              }}
            >
              {f.name}
            </button>
          ))}
        </aside>
        <div>
          {uploadTab ? (
            <div className="video-upload-drop">
              <Upload size={30} />
              <h3>上传视频到素材库</h3>
              <p>MP4 / WebM / MOV · 单文件最大 1 GB</p>
              <input
                aria-label="上传视频素材"
                type="file"
                accept=".mp4,.webm,.mov"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = '';
                }}
              />
              {busy && (
                <p role="status">
                  正在上传 {progress}%<progress value={progress} max={100} />
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="video-source-grid">
                {result.rows.map((s: any) => (
                  <article key={s.id} className={'media-card source-library-card '+(selected?.id===s.id?'selected':'')}>
                    <button type="button" className="media-picture" aria-label={'选择 '+s.name} onClick={()=>setSelected(s)}>
                      <SourceThumbnail source={s}/>
                      {selected?.id===s.id&&<span className="media-check"><Check size={18}/></span>}
                    </button>
                    <p title={s.name}>{s.name}</p>
                    <small className="source-size">{(s.size/1024/1024).toFixed(1)} MB · 已就绪</small>
                    <div className="source-card-actions"><button type="button" className="btn" onClick={()=>setPreview(s)}>预览</button><button type="button" className="btn" onClick={()=>setSelected(s)}>{onSelect?'选择':'管理'}</button></div>
                  </article>
                ))}
              </div>
              {!result.rows.length && (
                <p className="muted">暂无视频素材，可切换“上传新素材”。</p>
              )}
              {legacy.length > 0 && (
                <details>
                  <summary>已有视频素材（导入为私有副本）</summary>
                  {legacy.map((s: any) => (
                    <button aria-busy={Boolean(busy)}
                      className="btn"
                      key={s.id}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          const copy = await request(
                            'source-import',
                            {
                              id: s.id,
                              folder: folder === 'unfiled' ? '' : folder,
                            },
                            true,
                          );
                          setSelected(copy);
                          await reload();
                        } catch (e: any) {
                          setError(e.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {s.name} · 导入选择
                    </button>
                  ))}
                </details>
              )}
            </>
          )}
        </div>
      </div>
      <div className="video-library-footer">
        <div className="flex-actions">
          <span>
            共 {result.total || 0} 项 · {result.page || 1}/{result.pages}页
          </span>
          <button aria-busy={Boolean(busy)}
            className="btn"
            disabled={busy || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </button>
          <button aria-busy={Boolean(busy)}
            className="btn"
            disabled={busy || page >= result.pages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </button>
        </div>
        {selected && !onSelect && <div className="flex-actions">
          <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={async () => {
            const name = window.prompt('素材名称', selected.name);
            if (!name?.trim()) return;
            try { await request('source-update', { id: selected.id, name, folder: selected.folder }, true); setSelected({...selected, name}); await reload(); } catch(e: any) { setError(e.message); }
          }}>重命名</button>
          <select aria-label="移动到文件夹" value={selected.folder || ''} onChange={async e => {
            const folder = e.target.value;
            try { await request('source-update', {id:selected.id, name:selected.name, folder}, true); setSelected({...selected, folder}); await reload(); } catch(e: any) { setError(e.message); }
          }}><option value="">未分组</option>{(data?.folders || []).map((f:any)=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={async () => {
            if (!window.confirm('删除此视频素材？已关联素材不能删除。')) return;
            try { await request('source-delete', {id:selected.id}, true); setSelected(null); await reload(); } catch(e:any) { setError(e.message); }
          }}>删除</button>
        </div>}
        {onSelect && (
          <div className="flex-actions">
            <span>已选 {selected ? 1 : 0}</span>
            <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={onClose}>
              取消
            </button>
            <button aria-busy={Boolean(busy)}
              className="btn primary"
              disabled={busy || !selected}
              onClick={() => onSelect(selected)}
            >
              确认选择
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default function VideoSourcePicker(props: any) {
  const [uploading, setUploading] = useState(false);
  return (
    <Dialog guardChanges={false} open onOpenChange={(o) => !o && !uploading && props.onClose()}>
      <DialogContent size="media" className="private-video-picker">
        <DialogHeader>
          <DialogTitle>选择视频素材</DialogTitle>
          <DialogDescription>
            选择已有视频，或上传新素材后确认。原文件保存在私有素材库。
          </DialogDescription>
        </DialogHeader>
        <VideoSourceLibrary {...props} onBusy={setUploading} />
      </DialogContent>
    </Dialog>
  );
}
