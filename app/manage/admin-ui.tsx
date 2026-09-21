'use client';
import type { ReactNode } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
export function AdminPageHeader({ title, description, actions, onBack, backLabel='返回列表' }: {title:ReactNode;description?:ReactNode;actions?:ReactNode;onBack?:()=>void;backLabel?:string}) {
  return <header className="admin-page-header"><div className="admin-page-heading">{onBack && <button type="button" className="btn" onClick={onBack}><ArrowLeft size={16}/>{backLabel}</button>}<div><h1>{title}</h1>{description && <p className="muted">{description}</p>}</div></div>{actions && <div className="flex-actions">{actions}</div>}</header>;
}
export function AdminPagination({page=1,pages=1,total=0,onPage,busy=false,children}: {page?:number;pages?:number;total?:number;onPage:(page:number)=>void;busy?:boolean;children?:ReactNode}) {
  return <nav className="list-pager" aria-label="列表分页"><span>共 {total} 条 · 第 {page} / {Math.max(1,pages)} 页</span>{children}<div className="flex-actions"><button type="button" className="btn" disabled={busy||page<=1} onClick={()=>onPage(page-1)}><ChevronLeft size={14}/>上一页</button><button type="button" className="btn" disabled={busy||page>=pages} onClick={()=>onPage(page+1)}>下一页<ChevronRight size={14}/></button></div></nav>;
}
export function AdminDetailState({loading,error,onBack,onRetry}: {loading:boolean;error:string;onBack:()=>void;onRetry:()=>void}) {
  return <section><AdminPageHeader title={loading?'正在打开详情':'详情暂时不可用'} onBack={onBack}/><div className="panel admin-detail-state" role={error?'alert':'status'}>{loading ? <><span className="list-skeleton-line"/><p>正在读取详情…</p></> : <><p>{error}</p><button className="btn" onClick={onRetry}>重新加载</button></>}</div></section>;
}
export function AdminTabs({value,items,onChange,label}: {value:string;items:readonly (readonly [string,string])[];onChange:(value:string)=>void;label:string}) {
  return <nav className="admin-tabs" aria-label={label}>{items.map(([key,title])=><button type="button" key={key} aria-pressed={key===value} onClick={()=>onChange(key)}>{title}</button>)}</nav>;
}
