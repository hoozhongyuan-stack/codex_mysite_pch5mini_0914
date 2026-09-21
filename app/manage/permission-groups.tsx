'use client';
import { useCallback, useEffect, useState } from 'react';
import './permission-groups.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, AdminFormActions, useDialogChangeRevision } from './admin-dialog';

async function api(action: string, data: any = {}) {
  const response = await fetch('/api/staff/permissions-' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const result: any = await response.json();
  if (!response.ok) throw Error(result.error || '权限服务暂不可用');
  return result;
}

export default function PermissionGroups({integrated=false,onAccountLogs}:{integrated?:boolean;onAccountLogs?:(email:string)=>void}) {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState('groups');
  const [edit, setEdit] = useState<any>(null);
  const [member, setMember] = useState<any>(null);
  const [legacy, setLegacy] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editRevision, markEdited] = useDialogChangeRevision();
  const openEdit = (value: any) => { setMessage(''); setEdit(value); };
  const openMember = (value: any) => { setMessage(''); setMember(value); };
  const openLegacy = (value: any) => { setMessage(''); setLegacy(value); };
  const [membersOf,setMembersOf]=useState<any>(null);
  const load = useCallback(async () => setData(await api('list')), []);
  useEffect(() => { load().catch((e) => setMessage(e.message)); }, [load]);
  const label = (key: string) => data?.catalog.find((p: any) => p.key === key)?.label || key;
  const templates = [
    { name: '订单履约', permissions: ['orders.view', 'orders.manage', 'orders.fulfill', 'orders.aftersale'] },
    { name: '订单财务', permissions: ['orders.view', 'orders.finance', 'orders.export'] },
    { name: '营销活动运营', permissions: ['marketing.view', 'marketing.manage', 'marketing.checkin', 'marketing.export'] },
    { name: '内容与素材维护', permissions: ['content.view', 'content.manage', 'assets.view', 'assets.manage'] },
    { name: '表单与访客服务', permissions: ['forms.view', 'forms.manage', 'forms.export', 'visitors.view', 'visitors.manage'] },
    { name: '运营数据观察', permissions: ['orders.view', 'marketing.view', 'analytics.view'] },
    { name: '站点与小程序配置', permissions: ['configuration.manage'] },
  ];
  async function save(action: string, input: any) {
    setBusy(true); setMessage('');
    try {
      await api(action, input);
      setEdit(null); setMember(null); setLegacy(null);
      await load();
      setMessage('保存成功，权限将在后续请求生效');
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <section className="permission-workspace">
    <div className="heading-row"><h2>权限组设置</h2>{tab === 'groups' && <button className="btn primary" disabled={!data} onClick={() => openEdit({ name: '', permissions: [], active: true })}>新增权限组</button>}</div>
    <p className="muted">用岗位模板快速创建权限组，再按实际职责增减操作。超级管理员始终保留完整权限；既有编辑员保留内容与素材基线，其他模块仅按已分配权限组开放。</p>
    <div className="admin-tabs" role="tablist" aria-label="权限设置栏目">{(integrated?[['groups','权限组列表'],['legacy','历史授权']]:[['groups','权限组'],['members','成员分配'],['legacy','历史授权'],['logs','操作记录']]).map(([key, title]) => <button key={key} role="tab" aria-selected={tab === key} className={'btn '+(tab === key ? 'primary' : '')} onClick={() => { setTab(key); setEdit(null); setMember(null); setLegacy(null); setMembersOf(null); }}>{title}</button>)}</div>
    {message && <p role="status" className="notice">{message}</p>}
    {!data ? <div className="panel"><p>{message ? '权限数据加载失败' : '正在加载权限设置…'}</p>{message && <button className="btn" onClick={() => load().then(() => setMessage('')).catch((e) => setMessage(e.message))}>重新加载</button>}</div> : <>
      {tab === 'groups' && <><div className="permission-templates" aria-label="岗位模板">{templates.map((template)=><button type="button" className="permission-template" key={template.name} onClick={()=>openEdit({name:template.name,permissions:template.permissions,active:true})}><strong>{template.name}</strong><span>{template.permissions.map(label).join('、')}</span><small>按此模板创建</small></button>)}</div><div className="panel permission-table"><table className="list-table"><thead><tr><th>权限组</th><th>操作权限</th><th>成员</th><th>状态</th><th>操作</th></tr></thead><tbody>
        {data.groups.map((group: any) => <tr key={group.id}><td>{group.name}</td><td>{group.permissions.map(label).join('、') || '未附加操作权限'}</td><td><button className="btn" onClick={()=>setMembersOf(group)}>查看成员（{data.members.filter((r: any) => r.groupIds.includes(group.id)).length}）</button></td><td>{group.active ? '启用' : '停用'}</td><td><button className="btn" onClick={() => openEdit({ ...group })}>编辑</button></td></tr>)}
        {!data.groups.length && <tr><td colSpan={5}>暂无权限组。现有角色与历史授权保持原有范围。</td></tr>}
      </tbody></table></div></>}
      {tab === 'members' && <><div role="status" className="notice">编辑员基线：文章、商品、表单内容与分类，以及素材上传、整理、改名和删除。基线由账号角色决定；停用账号不会因分配权限组恢复登录。</div><div className="panel permission-table"><table className="list-table"><thead><tr><th>管理员</th><th>角色 / 状态</th><th>权限组</th><th>额外生效权限</th><th>操作</th></tr></thead><tbody>
        {data.members.map((row: any) => <tr key={row.id}><td>{row.username}<small>{row.email}</small></td><td>{row.role === 'owner' ? '超级管理员' : '编辑员'} / {row.active ? '启用' : '停用'}</td><td>{data.groups.filter((g: any) => row.groupIds.includes(g.id)).map((g: any) => g.name + (g.active ? '' : '（停用）')).join('、') || '未分配'}</td><td>{row.role === 'owner' ? '全部后台操作（角色基线）' : [...new Set([...row.effectivePermissions.map(label), ...(data.legacyOrders[row.email.toLowerCase()] || []).map((p: string) => label('orders.' + p))])].join('、') || '无额外权限'}</td><td>{row.role === 'owner' ? '角色固定完整权限' : <button className="btn" onClick={() => openMember({ ...row })}>分配权限组</button>}</td></tr>)}
      </tbody></table></div></>}
      {tab === 'legacy' && <><p role="status" className="notice">历史授权与权限组叠加生效，不会自动扩大或迁移。可在这里编辑或清空历史授权；彻底撤销操作权限时，请同时检查权限组与角色基线。新授权请使用权限组。</p><div className="panel permission-table"><table className="list-table"><thead><tr><th>管理员邮箱</th><th>来源</th><th>原有操作</th><th>操作</th></tr></thead><tbody>
        {Object.entries(data.legacyOrders).map(([email, permissions]: any) => <tr key={'o'+email}><td>{email}</td><td>历史订单授权</td><td>{permissions.map((p: string) => label('orders.' + p)).join('、') || '无'}</td><td><button className="btn" onClick={() => openLegacy({ email, permissions: [...permissions], previous: permissions, module: 'orders' })}>编辑 / 撤销</button></td></tr>)}
        {data.legacyMarketing.map((row: any) => <tr key={'m'+row.email}><td>{row.email}</td><td>历史营销授权</td><td>{row.permissions.map((p: string) => label('marketing.' + p)).join('、') || '无'}</td><td><button className="btn" onClick={() => openLegacy({ ...row, permissions: [...row.permissions], previous: row.permissions, module: 'marketing' })}>编辑 / 撤销</button></td></tr>)}
        {!Object.keys(data.legacyOrders).length && !data.legacyMarketing.length && <tr><td colSpan={4}>暂无历史授权</td></tr>}
      </tbody></table></div></>}
      {tab === 'logs' && <><p className="muted">最近200条权限组与成员分配操作；记录不可编辑或删除。</p><div className="panel permission-table"><table className="list-table"><thead><tr><th>时间</th><th>操作者</th><th>操作 / 对象</th><th>变更</th></tr></thead><tbody>
        {data.logs.map((log: any) => <tr key={log.id}><td>{new Date(log.created).toLocaleString('zh-CN')}</td><td>{log.actor}</td><td>{log.action === 'group-save' ? '保存权限组' : log.action === 'member-assign' ? '分配成员' : '修改历史授权'}<small>{log.target}</small></td><td><details><summary>查看前后记录</summary><p>变更前</p><pre>{JSON.stringify(log.before, null, 2)}</pre><p>变更后</p><pre>{JSON.stringify(log.after, null, 2)}</pre></details></td></tr>)}
        {!data.logs.length && <tr><td colSpan={4}>暂无权限操作记录</td></tr>}
      </tbody></table></div></>}
      {membersOf&&<Dialog guardChanges={false} open onOpenChange={open => !open && setMembersOf(null)}><DialogContent size="md"><DialogHeader><DialogTitle>{membersOf.name} · 所属成员</DialogTitle></DialogHeader><p>已分配 {data.members.filter((r:any)=>r.groupIds.includes(membersOf.id)).length} 人，其中启用且无需改密的编辑员 {data.members.filter((r:any)=>r.groupIds.includes(membersOf.id)&&r.active&&!r.mustChange&&r.role==='editor').length} 人。其他权限来源可能仍授予相同操作。</p>{data.members.filter((r:any)=>r.groupIds.includes(membersOf.id)).map((r:any)=><p key={r.id}><button className="account-link" onClick={()=>onAccountLogs?.(r.email)}>{r.username} · {r.email}</button> · {r.active?'启用':'停用'}</p>)}<AdminFormActions showCancel={false}><DialogClose render={<button className="btn" type="button" aria-label="关闭"/>}>关闭</DialogClose></AdminFormActions></DialogContent></Dialog>}
      {edit && <Dialog changeRevision={editRevision} open onOpenChange={open => {if (!open && !busy) setEdit(null);}}><DialogContent size="lg"><DialogHeader><DialogTitle>{edit.id ? '编辑权限组' : '新增权限组'}</DialogTitle></DialogHeader><form className="permission-editor" onSubmit={(e) => { e.preventDefault(); void save('save', edit); }}>{message && <p role="alert" className="error">{message}</p>}{edit.id&&<p role="status" className="notice">本次修改影响已分配此组的 {data.members.filter((r:any)=>r.groupIds.includes(edit.id)).length} 个账号；其他组、角色与历史授权继续生效。</p>}<label className="field">权限组名称<input maxLength={80} required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })}/></label>
        {Array.from(new Set<string>(data.catalog.map((p: any) => String(p.module)))).map((module) => <fieldset key={module}><legend>{module}操作</legend><div className="permission-checks">{data.catalog.filter((p: any) => p.module === module).map((p: any) => <label key={p.key}><input type="checkbox" checked={edit.permissions.includes(p.key)} onChange={(e) => setEdit({ ...edit, permissions: e.target.checked ? [...edit.permissions, p.key] : edit.permissions.filter((key: string) => key !== p.key) })}/>{p.label}</label>)}</div></fieldset>)}
        <p className="muted">各项独立生效，勾选操作不会自动附加查看或导出权限；需要查看列表时请同时勾选对应查看权限。</p><label className="permission-toggle"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })}/>启用权限组</label><p className="muted">停用后组内授权停止生效，账号角色及历史授权保持不变。</p><AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>{busy ? '保存中…' : '保存权限组'}</button></AdminFormActions></form></DialogContent></Dialog>}
      {member && <Dialog changeRevision={editRevision} open onOpenChange={open => {if (!open && !busy) setMember(null);}}><DialogContent size="md"><DialogHeader><DialogTitle>分配权限组 · {member.username}</DialogTitle></DialogHeader><form className="permission-editor" onSubmit={(e) => { e.preventDefault(); void save('assign', { accountId: member.id, revision: member.revision, groupIds: member.groupIds }); }}>{message && <p role="alert" className="error">{message}</p>}<div className="permission-checks">{data.groups.map((g: any) => <label key={g.id}><input type="checkbox" checked={member.groupIds.includes(g.id)} onChange={(e) => setMember({ ...member, groupIds: e.target.checked ? [...member.groupIds, g.id] : member.groupIds.filter((id: string) => id !== g.id) })}/>{g.name}{g.active ? '' : '（已停用，不生效）'}</label>)}</div>{!data.groups.length && <p>请先创建权限组。</p>}<p className="muted">保存会替换该成员的权限组分配，不改变账号角色、启停状态或历史授权。</p><AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>{busy ? '保存中…' : '保存分配'}</button></AdminFormActions></form></DialogContent></Dialog>}
      {legacy && <Dialog changeRevision={editRevision} open onOpenChange={open => {if (!open && !busy) setLegacy(null);}}><DialogContent size="md"><DialogHeader><DialogTitle>历史授权 · {legacy.email}</DialogTitle></DialogHeader><form className="permission-editor" onSubmit={(e) => { e.preventDefault(); void save('legacy-' + legacy.module, { email: legacy.email, permissions: legacy.permissions, previous: legacy.previous }); }}>{message && <p role="alert" className="error">{message}</p>}<div className="permission-checks">{data.catalog.filter((p: any) => p.key.startsWith(legacy.module + '.')).map((p: any) => { const key = p.key.split('.')[1]; return <label key={p.key}><input type="checkbox" checked={legacy.permissions.includes(key)} onChange={(e) => setLegacy({ ...legacy, permissions: e.target.checked ? [...legacy.permissions, key] : legacy.permissions.filter((v: string) => v !== key) })}/>{p.label}</label>; })}</div><p className="muted">全部取消勾选并保存可撤销此来源的授权；权限组和超级管理员角色可能仍授予相同操作。</p><AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} type="button" className="btn" disabled={busy} onClick={() => {markEdited(); setLegacy({ ...legacy, permissions: [] });}}>清空勾选</button><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>{busy ? '保存中…' : '保存历史授权'}</button></AdminFormActions></form></DialogContent></Dialog>}
    </>}
  </section>;
}
