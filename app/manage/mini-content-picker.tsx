'use client';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './admin-dialog';
export default function MiniContentPicker({target, value, onSelect, onClose}: any) {
  const kind = ({product:'products',article:'articles',form:'forms',video:'videos',event:'events'} as Record<string,string>)[target];
  const [query,setQuery]=useState(''),[page,setPage]=useState(1),[rows,setRows]=useState<any[]>([]),[pages,setPages]=useState(1),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setRows([]);
    const timer=setTimeout(async()=>{
      try {
        const params=new URLSearchParams({kind,q:query,page:String(page),size:'20',status:'published',channel:'mini'});
        const endpoint = target==='video'?'/api/video/list':target==='event'?'/api/marketing/admin-list':'/api/admin/list';
        const response=await fetch(endpoint+'?'+params,{signal:controller.signal});
        const data:any=await response.json();if(!response.ok)throw Error(data.error||'读取内容失败');
        if(!controller.signal.aborted){setRows(data.rows.map((r:any)=>({...r,titleZh:r.titleZh||r.title}))); setPages(data.pages||Math.max(1,Math.ceil((data.total||data.rows.length)/20)));}
      } catch(e){if(!controller.signal.aborted)setError((e as Error).message)}
      finally{if(!controller.signal.aborted)setLoading(false)}
    },200);
    return()=>{clearTimeout(timer);controller.abort()};
  },[kind,target,query,page,retry]);
  return <Dialog guardChanges={false} open onOpenChange={open=>!open&&onClose()}><DialogContent size="lg" className="mini-content-dialog"><DialogHeader><DialogTitle>选择关联内容</DialogTitle><DialogDescription>{['video','event'].includes(target)?'视频与沙龙会沿用已发布的公开内容。':'仅展示已发布且启用小程序渠道的内容。'}</DialogDescription></DialogHeader>
    <input className="input" aria-label="搜索关联内容" maxLength={100} placeholder="搜索名称 / 商品编码" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/>
    <div className="mini-content-results" aria-busy={Boolean(loading)}>
      {loading?<p role="status">正在读取…</p>:error?<div role="alert">{error}<button className="btn" onClick={()=>setRetry(retry+1)}>重试</button></div>:!rows.length?<p className="mini-empty">{query?'没有匹配内容，请修改搜索条件。':['video','event'].includes(target)?'暂无可选内容。请先发布视频系列或沙龙会，再点击刷新。':'暂无可选内容。请先在对应内容管理中发布，并启用“小程序”展示渠道，再点击刷新。'}</p>:rows.map(row=><button type="button" className={'mini-content-option '+(row.id===value?'selected':'')} key={row.id} onClick={()=>onSelect(row)}>{row.imageId&&<img src={'/api/media/'+row.imageId} alt=""/>}<span><strong>{row.titleZh}</strong><small>{row.spu||row.slug} · 已发布{['video','event'].includes(target)?' · 公开内容':' · 小程序'}</small></span><span>选择</span></button>)}
    </div><div className="flex-actions"><button className="btn" onClick={()=>setRetry(retry+1)}>刷新内容</button><button aria-busy={Boolean(loading)} className="btn" disabled={page===1||loading} onClick={()=>setPage(page-1)}>上一页</button><span>{page} / {pages}</span><button aria-busy={Boolean(loading)} className="btn" disabled={page>=pages||loading} onClick={()=>setPage(page+1)}>下一页</button></div>
  </DialogContent></Dialog>
}
