'use client';
import { pointLabel } from '@/lib/point-labels';
import { useEffect, useState, type SyntheticEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, AdminFormActions } from './admin-dialog';
import { AdminPagination } from './admin-ui';

export default function PointLedger({initialTab = 'accounts'}: {initialTab?: string}) {
  const [tab] = useState(initialTab), [page, setPage] = useState(1), [q, setQ] = useState(''), [query, setQuery] = useState(''), [revision, setRevision] = useState(0);
  const [data, setData] = useState<any>({ rows: [] }), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<any>(null), [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    fetch(`/api/points/${tab}?page=${page}&q=${encodeURIComponent(query)}`, {signal: controller.signal})
      .then(async response => {
        const result: any = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (!controller.signal.aborted) setData(result);
      })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tab, page, query, revision]);

  async function adjust(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/points/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({userId: selected.id, amount: Number(amount), reason, requestId: selected.requestId}) });
      const result: any = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSelected(null); setNotice('积分调整已保存'); setRevision(value => value + 1);
    } catch (error: any) { setError(error.message); } finally { setBusy(false); }
  }

  return <section className="points-card">
    <form onSubmit={event => { event.preventDefault(); setQuery(q); setPage(1); setRevision(value => value + 1); }} className="admin-filter-bar">
      <label className="field"><span>邮箱 / 姓名 / 流水原因</span><input placeholder="输入检索内容" value={q} onChange={event => setQ(event.target.value)}/></label>
      <button className="btn primary" disabled={loading}>查询</button>
      <button className="btn" type="button" disabled={loading} onClick={() => {setQ('');setQuery('');setPage(1);setRevision(value => value + 1);}}>重置</button>
    </form>
    {notice && <p role="status" className="notice">{notice}</p>}
    {loadError && <p role="alert" className="error">{loadError} {data.rows.length > 0 && '当前保留上次结果。'} <button type="button" className="btn" onClick={() => setRevision(value => value + 1)}>重试</button></p>}
    {loading && data.rows.length > 0 && <p role="status" className="muted">正在更新，当前显示上次结果…</p>}
    <div className="table-wrap" aria-busy={loading}><table className="list-table"><thead><tr>{(tab === 'accounts' ? ['访客', '余额', '操作'] : ['访客', '变动', '余额', '来源', '原因', '时间']).map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>
      {!data.rows.length && <tr><td colSpan={tab === 'accounts' ? 3 : 6}><p role="status">{loading ? '正在加载积分记录…' : loadError ? '积分记录加载失败，请重试。' : '暂无符合条件的记录'}</p></td></tr>}
      {data.rows.map((row: any) => <tr key={row.id}>
        {tab === 'accounts' ? <><td>{row.email}</td><td>{row.pointaccount__balance || 0}</td><td><button type="button" className="btn" disabled={loading} onClick={() => { setSelected({...row, requestId: crypto.randomUUID()}); setAmount(''); setReason(''); setError(''); }}>调整积分</button></td></> : <><td>{row.user__email}</td><td>{row.amount}</td><td>{row.balance}</td><td>{pointLabel(row.source)}</td><td>{row.reason}</td><td>{new Date(row.created).toLocaleString()}</td></>}
      </tr>)}
    </tbody></table></div>
    <AdminPagination page={page} pages={Math.max(1, Math.ceil((data.total || 0) / 20))} total={data.total || 0} onPage={setPage} busy={loading}/>
    {selected && <Dialog open onOpenChange={open => {if (!open && !busy) setSelected(null);}}><DialogContent size="sm"><DialogHeader><DialogTitle>调整积分 · {selected.email}</DialogTitle></DialogHeader>
      <form onSubmit={adjust}>
        <label className="field"><span>积分变动（正数增加，负数扣减）</span><input required type="number" min="-1000000" max="1000000" value={amount} onChange={event => setAmount(event.target.value)}/></label>
        <label className="field"><span>调整原因</span><textarea required maxLength={300} value={reason} onChange={event => setReason(event.target.value)}/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <AdminFormActions busy={busy}><button aria-busy={busy} className="btn primary" disabled={busy}>{busy ? '正在调整…' : '确认调整'}</button></AdminFormActions>
      </form>
    </DialogContent></Dialog>}
  </section>;
}
