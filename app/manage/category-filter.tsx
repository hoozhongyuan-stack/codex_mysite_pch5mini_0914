'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
export default function CategoryFilter({ categories, value, onChange, label='商品分类' }: any) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  const menuId=useId();
  const trigger=useRef<HTMLButtonElement>(null);
  const root=useRef<HTMLDivElement>(null);
  const items=categories.filter((c:any)=>c.kind==='products');
  const rows=items.filter((c:any)=>!c.parentId).flatMap((c:any)=>[c,...items.filter((x:any)=>x.parentId===c.id)]);
  useEffect(()=>{const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
  return <div className="category-filter" ref={root} onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);trigger.current?.focus()}}}>
    <button type="button" ref={trigger} className="category-filter-trigger" aria-label={label} aria-controls={open?menuId:undefined} aria-expanded={open} onClick={()=>{setOpen(!open);setQuery('')}}>
      {items.find((c:any)=>c.id===value)?.nameZh||'全部分类'}<ChevronDown size={16}/>
    </button>
    {open&&<div id={menuId} className="category-filter-menu">
      <label className="category-filter-search"><Search size={15}/><input autoFocus aria-label="搜索分类" placeholder="搜索分类" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="category-filter-options">
      {[{id:'',nameZh:'全部分类'},...rows].filter(c=>c.nameZh.toLowerCase().includes(query.toLowerCase())).map(c=><button type="button" key={c.id} className={c.parentId?'is-child':''} aria-pressed={value===c.id} onClick={()=>{onChange(c.id);setOpen(false);trigger.current?.focus()}}><span>{c.nameZh}</span>{value===c.id&&<Check size={15}/>}</button>)}
      </div>
    </div>}
  </div>
}
