'use client';
import { useState, useEffect } from 'react';
export default function StaffAccounts({onLogs}:{onLogs?:(email:string)=>void}) {
  const [rows, setRows] = useState<any[]>([]),
    [edit, setEdit] = useState<any>(null),
    [message, setMessage] = useState('');
  const [permissions,setPermissions]=useState<any>(null),[assignment,setAssignment]=useState<any>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const api = async (action: string, data: any = {}) => {
    const r = await fetch('/api/staff/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const d = (await r.json()) as any;
    if (!r.ok) throw Error(d.error);
    return d;
  };
  const load = () => {
    setLoading(true);
    return api('permissions-list')
      .then((d) => {setRows(d.members);setPermissions(d);})
      .catch((e) => setMessage(e.message))
      .finally(()=>setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <section>
      <div className="heading-row">
        <h2>子账号</h2>
        <button
          className="btn primary"
          onClick={() =>
            setEdit({
              username: '',
              email: '',
              role: 'editor',
              active: true,
              password: '',
            })
          }
        >
          新增子账号
        </button>
      </div>
      <p role="status" className="notice">
        账号与访客独立。新账号或重置密码后首次登录必须修改密码。邮箱用于关联订单与营销权限，创建后保持不变。
      </p>
      {message && <p role="status">{message}{!permissions&&<button className="btn" onClick={load}>重试</button>}</p>}
      <div className="panel account-table">
        <table className="video-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>权限</th>
              <th>状态</th>
              <th>所属权限组</th>
              <th>实际有效权限</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length&&<tr><td colSpan={8}>{loading?'正在加载账号…':message?'账号加载失败':'暂无子账号'}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><button className="account-link" onClick={()=>onLogs?.(r.email)} title="查看该账号相关操作日志">{r.username}</button></td>
                <td>{r.email}</td>
                <td>{r.role === 'owner' ? '超级管理员' : '编辑员'}</td>
                <td>{!r.active?'停用':r.mustChange?'待修改初始密码':'启用'}</td>
                <td>{permissions?.groups.filter((g:any)=>r.groupIds.includes(g.id)).map((g:any)=>g.name+(g.active?'':'（停用）')).join('、')||'未分配'}</td>
                <td>{!r.active||r.mustChange?'当前不可操作':r.role==='owner'?'全部后台操作（角色基线）':<details><summary>内容与素材基线 + {r.effectivePermissions.length} 项附加权限</summary><p>基线：内容、分类与素材操作。</p><p>{r.effectivePermissions.map((key:string)=>permissions.catalog.find((p:any)=>p.key===key)?.label||key).join('、')||'无附加权限'}</p></details>}</td>
                <td>
                  <button
                    className="btn"
                    disabled={r.bootstrap}
                    onClick={() => setEdit({ ...r, password: '' })}
                  >
                    {r.bootstrap
                      ? '初始管理员（个人设置修改）'
                      : '编辑 / 重置密码'}
                  </button>
                  {r.role!=='owner'&&<button className="btn" onClick={()=>setAssignment({...r})}>分配权限组</button>}
                  <button className="btn" onClick={()=>onLogs?.(r.email)}>操作日志</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assignment&&<form className="panel" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('permissions-assign',{accountId:assignment.id,revision:assignment.revision,groupIds:assignment.groupIds});setAssignment(null);setMessage('权限组分配已保存');await load();}catch(error:any){setMessage(error.message);}finally{setBusy(false);}}}><h3>分配权限组 · {assignment.username}</h3><div className="account-groups">{permissions.groups.map((g:any)=><label key={g.id}><input type="checkbox" checked={assignment.groupIds.includes(g.id)} onChange={e=>setAssignment({...assignment,groupIds:e.target.checked?[...assignment.groupIds,g.id]:assignment.groupIds.filter((id:string)=>id!==g.id)})}/>{g.name}{g.active?'':'（停用）'}</label>)}</div>{!permissions.groups.length&&<p>暂无权限组，请在权限组页签创建。</p>}<p className="muted">保持角色基线和历史授权。停用账号不因分配权限组恢复访问。</p><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>保存分配</button><button aria-busy={Boolean(busy)} type="button" className="btn" disabled={busy} onClick={()=>setAssignment(null)}>取消</button></form>}
      {edit && (
        <form
          className="panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api('save', edit);
              setEdit(null);
              setMessage('账号已保存');
              load();
            } catch (e: any) {
              setMessage(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>管理员配置</h2>
          {[
            ['username', '用户名'],
            ['email', '邮箱'],
            ['password', '初始 / 重置密码（已有账号留空不重置）'],
          ].map(([k, label]) => (
            <label className="field" key={k}>
              {label}
              <input
                type={
                  k === 'password'
                    ? 'password'
                    : k === 'email'
                      ? 'email'
                      : 'text'
                }
                disabled={k === 'email' && !!edit.id}
                value={edit[k]}
                required={k !== 'password' || !edit.id}
                onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
              />
            </label>
          ))}
          <select
            value={edit.role}
            onChange={(e) => setEdit({ ...edit, role: e.target.value })}
          >
            <option value="editor">编辑员</option>
            <option value="owner">超级管理员</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={edit.active}
              onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
            />
            启用
          </label>
          <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>保存</button>
          <button type="button" className="btn" onClick={() => setEdit(null)}>
            取消
          </button>
        </form>
      )}
    </section>
  );
}
