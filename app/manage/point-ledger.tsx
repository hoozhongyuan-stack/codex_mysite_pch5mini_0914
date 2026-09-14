'use client';
import { pointLabel } from '@/lib/point-labels';
import { useEffect, useState } from 'react';
export default function PointLedger({initialTab = 'accounts'}: {initialTab?: string}) {
  const [tab, setTab] = useState(initialTab), [page, setPage] = useState(1), [q, setQ] = useState(''), [query, setQuery] = useState(''), [revision, setRevision] = useState(0);
  const [data, setData] = useState<any>({ rows: [] }), [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null), [amount, setAmount] = useState(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/points/${tab}?page=${page}&q=${encodeURIComponent(query)}`).then(async r => { const d: any = await r.json(); if (!r.ok) throw new Error(d.error); if (live) setData(d); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [tab, page, query, revision]);
  async function adjust(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch('/api/points/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({userId: selected.id, amount: Number(amount), reason, requestId: selected.requestId}) });
      const d: any = await r.json(); if (!r.ok) throw new Error(d.error);
      setSelected(null); setRevision(n => n + 1);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="points-card">
    <form onSubmit={e => { e.preventDefault(); setQuery(q); setPage(1); }} className="points-search"><input aria-label="检索邮箱或姓名" placeholder="输入邮箱、姓名；流水可检索原因" value={q} onChange={e => setQ(e.target.value)}/><button className="btn">检索</button></form>
    {error && <p role="alert">{error}</p>}
    <div className="table-wrap"><table><thead><tr>{(tab === 'accounts' ? ['访客', '余额', '操作'] : ['访客', '变动', '余额', '来源', '原因', '时间']).map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{data.rows.map((r: any) => <tr key={r.id}>
      {tab === 'accounts' ? <><td>{r.email}</td><td>{r.pointaccount__balance || 0}</td><td><button type="button" className="btn" onClick={() => { setSelected({...r, requestId: crypto.randomUUID()}); setAmount(''); setReason(''); }}>调整积分</button></td></> : <><td>{r.user__email}</td><td>{r.amount}</td><td>{r.balance}</td><td>{pointLabel(r.source)}</td><td>{r.reason}</td><td>{new Date(r.created).toLocaleString()}</td></>}
    </tr>)}</tbody></table></div>
    <div className="content-interactions"><button type="button" className="btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>上一页</button><span>共 {data.total || 0} 条 · 第 {page} 页</span><button type="button" className="btn" disabled={page * 20 >= (data.total || 0)} onClick={() => setPage(p => p + 1)}>下一页</button></div>
    {selected && <form onSubmit={adjust} className="panel" style={{padding: 24}}><h3>调整积分 · {selected.email}</h3><label>积分变动（正数增加，负数扣减）<input required type="number" min="-1000000" max="1000000" value={amount} onChange={e => setAmount(e.target.value)}/></label><label>调整原因<textarea required maxLength={300} value={reason} onChange={e => setReason(e.target.value)}/></label><div className="content-interactions"><button aria-busy={Boolean(busy)} className="btn" disabled={busy}>确认调整</button><button aria-busy={Boolean(busy)} className="btn" type="button" disabled={busy} onClick={() => setSelected(null)}>取消</button></div></form>}
  </section>;
}
