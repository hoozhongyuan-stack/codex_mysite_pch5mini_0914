import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../../../app/globals.css';
import '../../../app/interaction.css';
import '../../../app/admin-compact.css';
import {AdminPageHeader,AdminTabs,AdminPagination} from '../../../app/manage/admin-ui';
import {Dialog,DialogContent,DialogHeader,DialogTitle,AdminFormActions} from '../../../app/manage/admin-dialog';
import {Field,Choice} from '../../../app/manage/shared';
import {Filters} from '../../../app/manage/list-ui';
import ActionFeedback from '../../../app/manage/action-feedback';
import {useAdminTab} from '../../../app/manage/admin-navigation';
function Preview(){
 const [tab,setTab]=useAdminTab('demo','list',['list','settings','detail','dialogs']);
 const [open,setOpen]=useState(false),[size,setSize]=useState<'sm'|'md'|'lg'|'editor'|'media'>('md'),[title,setTitle]=useState('演示内容'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[query,setQuery]=useState('');
 const list:any={query,loading:false,update:(values:any)=>{const p=new URLSearchParams(query);Object.entries(values).forEach(([k,v]:any)=>v?p.set(k,v):p.delete(k));setQuery(p.toString())}};
 const save=(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setTimeout(()=>{setBusy(false);setOpen(false);setMessage('演示保存成功：未写入任何业务数据。')},700)};
 return <div className="admin-workspace"><header className="admin-header"><b>GEO Studio · 后台组件规范</b><span className="muted">交互验收沙箱 · 仅演示数据</span></header><main className="workspace">
 <AdminPageHeader title="后台组件验收" description="使用实际公共组件，验证布局、尺寸与交互状态。" actions={<button className="btn primary" onClick={()=>{setSize('editor');setOpen(true)}}>新建内容</button>}/>
 <AdminTabs label="组件示例" value={tab} onChange={setTab} items={[
 ['list','列表与筛选'],['settings','配置表单'],['detail','详情与状态'],['dialogs','弹窗尺寸']
 ]}/>
 <ActionFeedback message={message} clear={()=>setMessage('')}/>
 {tab==='list'&&<><Filters list={list} fields={[{key:'q',label:'内容名称'},{key:'status',label:'发布状态',options:[['','全部'],['draft','草稿'],['published','已发布']]},{key:'channel',label:'展示渠道',options:[['','全部'],['web','网站'],['mini','小程序']]},{key:'author',label:'作者'},{key:'category',label:'分类',options:[['','全部'],['journal','灵感手记']]}]}/><div className="panel"><div className="list-batch"><span>已选 0 项</span><button className="btn" disabled>批量发布</button><button className="btn" disabled>导出所选</button></div><table className="list-table"><thead><tr><th>名称</th><th>分类</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead><tbody>{Array.from({length:8},(_,i)=><tr key={i}><td>示例内容 {i+1}{i===2?' · 较长标题也能保持正常换行与操作区域宽度':''}</td><td>灵感手记</td><td><span className="pill">已发布</span></td><td>2026-09-21 12:00</td><td><div className="flex-actions"><button className="btn" onClick={()=>{setSize('editor');setOpen(true)}}>编辑</button><button className="btn" onClick={()=>setTab('detail')}>详情</button></div></td></tr>)}</tbody></table><AdminPagination page={1} pages={1} total={8} onPage={()=>{}}/></div></>}
 {tab==='settings'&&<form className="panel admin-settings-panel" onSubmit={save}><h2>基础设置</h2><div className="field-grid"><Field label="网站名称" value={title} onChange={setTitle} required/><Choice label="发布状态" value="draft" items={[['draft','草稿'],['published','发布']]} onChange={()=>{}}/></div><h2>交易参数</h2><div className="field-grid"><Field label="未付款关闭时限（小时）" value="24" type="number" onChange={()=>{}}/><Field label="签收后售后期限（天）" value="7" type="number" onChange={()=>{}}/></div><Field label="中文说明" multiline value="此处是配置说明的演示内容。" onChange={()=>{}}/><AdminFormActions showCancel={false} busy={busy}><button className="btn primary" disabled={busy} aria-busy={busy}>保存配置</button></AdminFormActions></form>}
 {tab==='detail'&&<section><AdminPageHeader title="活动详情" onBack={()=>setTab('list')} backLabel="活动列表" actions={<button className="btn" onClick={()=>{setSize('lg');setOpen(true)}}>编辑活动</button>}/><AdminTabs label="活动详情栏目" value="info" onChange={()=>{}} items={[["info","活动信息"],["records","报名记录"],["stats","统计与签到"]]}/><div className="panel salon-details-panel"><h2>秋日分享会</h2><p>时间：2026-10-01 14:00 — 16:00</p><p>状态：报名中</p><p>地点：示例活动空间</p></div><p className="error" role="alert">演示错误状态：读取失败，请重试。<button className="btn" onClick={()=>setMessage('已完成演示重试')}>重试</button></p></section>}
 {tab==='dialogs'&&<div className="flex-actions">{(['sm','md','lg','editor','media'] as const).map(s=><button className="btn" key={s} onClick={()=>{setSize(s);setOpen(true)}}>{s} 弹窗</button>)}</div>}
 <Dialog open={open} onOpenChange={v=>!busy&&setOpen(v)}><DialogContent size={size}><DialogHeader><DialogTitle>编辑演示内容 · {size}</DialogTitle></DialogHeader><form onSubmit={save}><div className="field-grid"><Field required label="中文名称" value={title} onChange={setTitle}/><Field label="英文名称" value="Demo content" onChange={()=>{}}/></div><Field label="摘要" multiline value="演示：修改名称后取消关闭，应出现未保存提醒。" onChange={()=>{}}/><div className="field-grid"><Choice label="发布状态" value="draft" items={[["draft","草稿"],["published","已发布"]]} onChange={()=>{}}/><Field label="排序" type="number" value="1" onChange={()=>{}}/></div>{['lg','editor','media'].includes(size)&&Array.from({length:8},(_,i)=><Field key={i} label={'扩展字段 '+(i+1)} value="用于验证长表单滚动与保存栏" onChange={()=>{}}/>)}<AdminFormActions busy={busy}><button aria-busy={busy} className="btn primary" disabled={busy}>保存</button></AdminFormActions></form></DialogContent></Dialog>
 </main></div>
}
createRoot(document.getElementById('root')!).render(<Preview/>);
