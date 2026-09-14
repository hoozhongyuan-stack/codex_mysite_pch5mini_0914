'use client';
import { formatMoney } from '@/lib/product-options.mjs';
export default function ProductStockSummary({record}:any) {
 const t=record.trade;
 if(!t) return <span>待补充</span>;
 const enabled=(t.variants||[]).filter((v:any)=>v.enabled);
 const reservations=JSON.parse(record.stockReservations||'[]');
 const reserved=(key?:string)=>reservations.filter((v:any)=>!key||v.variant===key).reduce((n:number,v:any)=>n+v.quantity,0);
 const multi=!!t.specs?.length;
 const missing=multi?enabled.filter((v:any)=>v.inventory==null).length:(t.inventory==null?1:0);
 const stock=missing?null:Math.max(0,(multi?enabled.reduce((n:number,v:any)=>n+v.inventory,0):t.inventory)-reserved());
 const label=missing?`待补充${multi?' · '+missing+'个规格未填写':''}`:`${stock}${stock===0?' · 已售罄':''}`;
 if(!multi) return <span>{label}</span>;
 return <details><summary style={{cursor:'pointer',whiteSpace:'nowrap'}}>{label} · {enabled.length}个规格</summary><table className="list-table" style={{minWidth:320}}><thead><tr><th>规格</th><th>价格</th><th>可售库存</th><th>状态</th></tr></thead><tbody>{t.variants.map((v:any)=><tr key={v.key}><td>{t.specs.flatMap((s:any)=>s.values.filter((x:any)=>v.key.split('~').includes(x.id)).map((x:any)=>x.nameZh)).join(' / ')}</td><td>{formatMoney(v.priceMinor,t.currency)}</td><td>{v.inventory==null?'待补充':Math.max(0,v.inventory-reserved(v.key))}</td><td>{v.enabled?'启用':'停用'}</td></tr>)}</tbody></table></details>;
}
