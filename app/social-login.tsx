'use client';
import { useEffect, useState } from 'react';
export default function SocialLogin({ en, policies, user }: any) {
  const [config,setConfig] = useState<any>(null), [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [consent,setConsent] = useState(false);
  const names:any={wechat:en?'WeChat':'微信',google:'Google',facebook:'Facebook'};
  useEffect(()=>{fetch('/api/social/status').then(async r=>{if(r.ok)setConfig(await r.json())}).catch(()=>setMessage(en?'Sign-in service unavailable':'登录服务暂不可用'))},[en]);
  async function post(action:string,data:any){const r=await fetch('/api/social/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const d:any=await r.json();if(!r.ok)throw Error(d.error);return d;}
  if(!config)return null;
  const realProviders = config.providers.filter((p:any)=>p.realEnabled).sort((a:any,b:any)=>a.sort-b.sort);
  const realPanel = !user?.sandbox && realProviders.length > 0 ? <div className="social-real">
    <h3>{en ? 'Quick sign-in' : '快捷登录'}</h3>
    <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{en ? 'I agree to the' : '我已阅读并同意'} <a href={`/${en?'en':'zh'}/policies/terms`}>{en?'Terms':'注册协议'}</a> / <a href={`/${en?'en':'zh'}/policies/privacy`}>{en?'Privacy policy':'隐私协议'}</a></label>
    <div className="flex-actions">{realProviders.map((p:any)=><button aria-busy={Boolean(busy)} type="button" className="btn" key={p.provider} disabled={busy || !consent || user?.providers?.includes(p.provider)} onClick={async()=>{
      setBusy(true);setMessage('');try {const d=await post('oauth-start',{provider:p.provider,intent:user?'link':'login',returnTo:new URLSearchParams(window.location.search).get('returnTo'),lang:en?'en':'zh',consent,terms:policies.find((x:any)=>x.kind==='terms')?.version,privacy:policies.find((x:any)=>x.kind==='privacy')?.version}); window.location.assign(d.url);}catch(e){setMessage((e as Error).message);setBusy(false);}
    }}>{names[p.provider]}{user?(en?' Link':' 绑定'):(en?' sign-in':' 登录')}</button>)}</div>
    {message && <p role="alert">{message}</p>}
  </div> : null;
  return realPanel;
}
