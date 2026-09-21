'use client';
import { useAdminTab } from './admin-navigation';
import { AdminTabs } from './admin-ui';
import PointLedger from './point-ledger';
import { useEffect, useState } from 'react';
export default function PointsManager() {
  const [tab, setTab] = useAdminTab('pointsTab','accounts',['accounts','ledger','rules']);
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    fetch('/api/points/rules').then(async r => {
      const data: any = await r.json();
      if (!r.ok) throw new Error(data.error || '读取失败');
      setRows(data.rows);
    }).catch(e => setMessage(e.message));
  }, []);
  async function save(row: any) {
    setBusy(row.key); setMessage('');
    try {
      const response = await fetch('/api/points/save-rule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row),
      });
      const data: any = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      setMessage(row.label + '：配置已保存');
    } catch (e: any) { setMessage(e.message); } finally { setBusy(''); }
  }
  return <section className="points-workspace"><header className="points-heading"><div><h1>积分管理</h1><p>管理访客积分、查看收支记录与配置奖励规则。</p></div></header>
    <AdminTabs label="积分功能" value={tab} items={[['accounts','积分账户'],['ledger','积分明细'],['rules','奖励规则']]} onChange={setTab}/>
    {tab !== 'rules' ? <PointLedger key={tab} initialTab={tab} /> : <div className="points-card"><div className="points-card-heading"><div><h2>奖励规则</h2><p>同类内容共享每日额度，按上海时区零点重置。0积分表示不发放。</p></div></div>
    <button aria-busy={Boolean(busy)} className="btn" type="button" disabled={!!busy} onClick={async () => {
      setBusy('retry');
      try { const r = await fetch('/api/points/retry-forms', {method:'POST'}); const d: any = await r.json(); if (!r.ok) throw new Error(d.error); setMessage(`已处理 ${d.count} 条待补发表单，失败 ${d.failed || 0} 条`); } catch (e: any) { setMessage(e.message); } finally { setBusy(''); }
    }}>重试待补发表单积分</button>
    <button aria-busy={Boolean(busy)} className="btn" type="button" disabled={!!busy} onClick={async () => {
      setBusy('retry-orders');
      try { const r = await fetch('/api/points/retry-orders', {method:'POST'}); const d: any = await r.json(); if (!r.ok) throw new Error(d.error); setMessage(`已处理 ${d.count} 条订单积分，失败 ${d.failed || 0} 条`); } catch (e: any) { setMessage(e.message); } finally { setBusy(''); }
    }}>重试待处理订单积分</button>
    {message && <p role="status">{message}</p>}
    <div className="table-wrap"><table className="list-table"><thead><tr><th>奖励规则</th><th>启用</th><th>奖励积分</th><th>操作</th></tr></thead><tbody>
    {rows.map(row => <tr key={row.key}><td>{row.label}</td><td><input aria-label={row.label + '启用'} type="checkbox" checked={row.enabled}
      onChange={e => setRows(items => items.map(item => item.key === row.key ? { ...item, enabled: e.target.checked } : item))}/></td>
      <td><input aria-label={row.label + '积分'} type="number" min="0" max="1000000" value={row.amount}
      onChange={e => setRows(items => items.map(item => item.key === row.key ? { ...item, amount: Number(e.target.value) } : item))}/></td>
      <td><button aria-busy={Boolean(busy)} className="btn" type="button" disabled={!!busy} onClick={() => save(row)}>{busy === row.key ? '保存中' : '保存配置'}</button></td></tr>)}
    </tbody></table></div></div>}</section>;
}
