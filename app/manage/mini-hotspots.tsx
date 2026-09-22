'use client';
import {useState} from 'react';
import MiniLinkPicker from './mini-link-picker';
import {Field} from './shared';
export default function MiniHotspots({items,onChange,selectImage,contents,microPages,onSave,busy,message}:any){
 const [drawing,setDrawing]=useState<any>(null),[active,setActive]=useState('');
 const update=(i:number,value:any)=>onChange(items.map((b:any,j:number)=>j===i?value:b));
 const round=(v:number)=>Math.round(v*100)/100;
 const zoneUpdate=(i:number,j:number,patch:any)=>update(i,{...items[i],zones:items[i].zones.map((z:any,k:number)=>k===j?{...z,...patch}:z)});
 const point=(e:any)=>{const r=e.currentTarget.getBoundingClientRect();return {x:round(Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))),y:round(Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100)))}};
 return <section className="mini-section"><div className="heading-row"><div><h3>图片热区</h3><p className="muted">在图片上拖动框选，分别设置跳转目标。最多10张图片，每图20个热区。</p></div><button className="btn" disabled={items.length>=10} onClick={()=>selectImage((imageId:string)=>onChange([...items,{imageId,zones:[]}]))}>添加热区图片</button></div>
 {!items.length&&<p className="mini-empty">添加一张图片，让不同区域通往不同内容。</p>}
 {items.map((b:any,i:number)=><div className="hotspot-editor" key={i}><div className="heading-row"><b>图片 {i+1} · {b.zones.length} 个热区</b><div className="flex-actions"><button className="btn" disabled={!i} onClick={()=>onChange(items.map((v:any,k:number)=>k===i?items[i-1]:k===i-1?b:v))}>上移</button><button className="btn" onClick={()=>selectImage((imageId:string)=>update(i,{...b,imageId,zones:[]}))}>更换图片并清空热区</button><button className="btn" onClick={()=>onChange(items.filter((_:any,k:number)=>k!==i))}>移除图片</button></div></div>
 <div className="hotspot-columns"><div><div className="hotspot-canvas" onPointerDown={e=>{if(b.zones.length>=20)return;e.currentTarget.setPointerCapture(e.pointerId);setDrawing({i,start:point(e),end:point(e)});}} onPointerMove={e=>{if(drawing?.i===i)setDrawing({...drawing,end:point(e)})}} onPointerCancel={()=>setDrawing(null)} onPointerUp={e=>{if(drawing?.i!==i)return;const a=drawing.start,c=point(e),x=Math.min(a.x,c.x),y=Math.min(a.y,c.y),width=round(Math.abs(a.x-c.x)),height=round(Math.abs(a.y-c.y));setDrawing(null);if(width<1||height<1)return;update(i,{...b,zones:[...b.zones,{label:'热区 '+(b.zones.length+1),x,y,width,height,target:'products',contentId:''}]});setActive(i+':'+b.zones.length);}}>
 <img src={'/api/media/'+b.imageId} alt={'热区图片 '+(i+1)} draggable={false}/>
 {b.zones.map((z:any,j:number)=><span key={j} className={'hotspot-outline '+(active===i+':'+j?'selected':'')} style={{left:z.x+'%',top:z.y+'%',width:z.width+'%',height:z.height+'%'}}>{j+1}</span>)}
 {drawing?.i===i&&<span className="hotspot-outline" style={{left:Math.min(drawing.start.x,drawing.end.x)+'%',top:Math.min(drawing.start.y,drawing.end.y)+'%',width:Math.abs(drawing.start.x-drawing.end.x)+'%',height:Math.abs(drawing.start.y-drawing.end.y)+'%'}}/>}</div><p className="muted">拖动添加区域；也可点击下方按钮后填写坐标。</p><button className="btn" disabled={b.zones.length>=20} onClick={()=>{update(i,{...b,zones:[...b.zones,{label:'热区 '+(b.zones.length+1),x:0,y:0,width:20,height:20,target:'products',contentId:''}]});setActive(i+':'+b.zones.length)}}>添加热区</button></div>
 <div className="hotspot-properties">{b.zones.map((z:any,j:number)=><details key={j} open={active===i+':'+j}  ><summary onClick={e=>{e.preventDefault();setActive(active===i+':'+j?'':i+':'+j)}}>热区 {j+1} · {z.label}</summary><Field label="名称" value={z.label} onChange={(label:string)=>zoneUpdate(i,j,{label})}/><MiniLinkPicker value={z} contents={contents} microPages={microPages} onChange={(next:any)=>zoneUpdate(i,j,next)}/><div className="hotspot-coordinates">{[['x','左侧 %'],['y','顶部 %'],['width','宽度 %'],['height','高度 %']].map(([k,l])=><label key={k}>{l}<input type="number" min="0" max="100" step="0.01" value={Math.round(z[k]*100)/100} onChange={e=>zoneUpdate(i,j,{[k]:Number(e.target.value)})}/></label>)}</div><button className="btn" onClick={()=>update(i,{...b,zones:b.zones.filter((_:any,k:number)=>k!==j)})}>删除热区</button></details>)}</div></div></div>)}
 <div className="mini-section-actions"><span role="status">{message || '热区随首页草稿保存；发布配置后生效。'}</span><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy} onClick={onSave}>保存热区草稿</button></div>

 </section>
}
