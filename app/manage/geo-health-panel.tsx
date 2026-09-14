'use client';
import SiteLink from '../../components/site-link';

import {useState} from 'react';
export default function GeoHealthPanel(){
 const [result,setResult]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function check(){setBusy(true);setError('');try{const r=await fetch('/api/geo/health',{method:'POST'});const d:any=await r.json();if(!r.ok)throw Error(d.error||'检查失败');setResult(d);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel" style={{padding:20,margin:'20px 0'}}><div className="heading-row"><div><h2>实时技术检查</h2><p className="muted">从服务器请求公开站点，检查响应头和实际HTML。点击后生成本次结果。</p></div><button aria-busy={Boolean(busy)} className="btn primary" onClick={check} disabled={busy}>{busy?'正在检查…':'检查公开站点'}</button></div>
 {error&&<p className="error" role="alert">{error}</p>}
 {!result&&<p>尚未运行本次检查。功能存在不代表当前页面符合收录条件。</p>}
 {result&&<><p>检查站点：<SiteLink href={result.origin} target="_blank" rel="noreferrer">{result.origin}</SiteLink> · {new Date(result.checkedAt).toLocaleString('zh-CN')}</p><p>{result.scope}</p><div role="status" className="notice">抓取规则：{result.robots.status!==200?'读取失败':result.robots.blocksAll?'禁止全站抓取':'未发现全站禁抓取规则'}；站点地图：{result.sitemap.status===200?result.sitemap.urls+'个地址':'读取失败'}。这些结果不代表搜索引擎已收录或AI已引用。</div>
 <div style={{overflowX:'auto'}}><table style={{width:'100%',fontSize:13}}><thead><tr><th>页面</th><th>HTTP</th><th>结构化类型</th><th>检查结果</th></tr></thead><tbody>{result.pages.map((p:any)=><tr key={p.path}><td><SiteLink href={result.origin+p.path} target="_blank" rel="noreferrer">{p.path}</SiteLink></td><td>{p.status||'失败'}</td><td>{p.schemaTypes.join('、')||'无'}</td><td>{p.issues.length?p.issues.join('；'):'本次基础检查通过'}</td></tr>)}</tbody></table></div>
 <details style={{marginTop:12}}><summary>内容与品牌待核对（{result.contentIssues.length}条内容）</summary>{result.brandIssue&&<p>{result.brandIssue}</p>}{result.contentIssues.map((r:any)=><p key={r.id}><b>{r.title}</b>：{r.issues.join('；')}</p>)}<p className="muted">仅提示，不自动更改发布状态；演示站点可保留已明确标注的演示内容。</p></details></>}
 </section>;
}
