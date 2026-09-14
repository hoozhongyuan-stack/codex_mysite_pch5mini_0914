'use client';
import { useEffect, useState } from 'react';
export default function SocialSettings({onSaved}:any) {
 const [data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const names:any={wechat:'微信网站扫码',google:'Google',facebook:'Facebook'};
 useEffect(()=>{fetch('/api/identity-admin/social').then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d)}).catch(e=>setMessage(e.message))},[]);
 async function save(payload:any){setBusy(true);setMessage('');try{const r=await fetch('/api/identity-admin/social-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d);onSaved?.();setMessage('渠道配置已保存。真实平台登录需应用资格、域名和回调配置匹配后验证。');return true}catch(e){setMessage((e as Error).message);return false}finally{setBusy(false)}}
 return <section className="panel settings-panel"><h2>登录与注册 · 快捷登录</h2><div role="status" className="notice"><b>温馨提示</b><p>每个渠道独立启用；关闭后前台不展示，后台也拒绝授权。未填写完整应用配置无法启用。密钥仅在服务端加密保存，留空保留现有密钥，不显示原文。</p><p>先到对应平台创建应用，配置下方回调地址。正式环境需要 HTTPS 域名、隐私政策与注册协议。应用审核及真实登录需要您配置后验收。</p></div>
 {data?.providers.map((p:any)=><div className="spec-editor-card" key={p.provider}>
 <form onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const saved=await save({provider:p.provider,mode:'real',enabled:f.get('enabled')==='on',clientId:f.get('clientId'),secret:f.get('secret'),sort:Number(f.get('sort'))});if(saved)(form.elements.namedItem('secret') as HTMLInputElement).value=''}}>
 <h3>{names[p.provider]} · 真实登录</h3><label><input type="checkbox" name="enabled" defaultChecked={p.realEnabled} disabled={busy}/> 启用真实登录</label>
 <label className="field"><span>应用 ID / Client ID</span><input name="clientId" defaultValue={p.clientId} maxLength={255}/></label>
 <label className="field"><span>应用密钥 / Client Secret {p.secretConfigured?'（已配置；留空保留）':'（未配置）'}</span><input type="password" name="secret" autoComplete="new-password" maxLength={2000} placeholder={p.secretConfigured ? '******' : '请输入应用密钥'}/></label>
 <label className="field"><span>显示顺序（0–99）</span><input name="sort" type="number" min={0} max={99} defaultValue={p.sort}/></label>
 <label className="field"><span>授权回调地址（由服务器 PUBLIC_ORIGIN 生成）</span><input readOnly value={p.callbackUrl}/></label><button type="button" className="btn" onClick={()=>navigator.clipboard.writeText(p.callbackUrl).then(()=>setMessage('回调地址已复制')).catch(()=>setMessage('请手动复制回调地址'))}>复制回调地址</button>
 <p className="muted">{p.provider==='wechat'?'需微信开放平台网站应用 AppID、AppSecret 和网站扫码登录资格；微信内公众号授权属于单独接入。':p.provider==='google'?'Google Cloud 创建 Web 类型 OAuth 客户端；设置同意页面、授权来源和完全一致的回调地址。':'Meta 应用配置 Facebook Login、App ID、App Secret 和有效 OAuth 回调 URI；按平台要求完成上线审核。'}</p>
 <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>保存真实登录配置</button></form>

 </div>)}{message&&<p role="status" className="notice">{message}</p>}</section>
}
