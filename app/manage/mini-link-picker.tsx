'use client';
import {useState} from 'react';
import {Choice} from './shared';
import MiniContentPicker from './mini-content-picker';
import {hotspotTargets,detailTargetKinds} from '@/lib/channel-config.mjs';
export default function MiniLinkPicker({value,onChange,contents=[],microPages=[]}:any){
 const [open,setOpen]=useState(false),[label,setLabel]=useState('');
 return <><Choice label="跳转页面" items={hotspotTargets} value={value.target} onChange={(target:string)=>{setLabel('');onChange({...value,target,contentId:''})}}/>
 {(detailTargetKinds as Record<string,string>)[value.target]&&<div className="field"><span>关联内容</span><button type="button" className="btn" onClick={()=>setOpen(true)}>{value.contentId?(label||contents.find((r:any)=>r.id===value.contentId)?.titleZh||microPages.find((r:any)=>r.id===value.contentId)?.title||'已关联内容 · 点击更换'):'选择内容'}</button></div>}
 {open&&<MiniContentPicker target={value.target} value={value.contentId} microPages={microPages} onClose={()=>setOpen(false)} onSelect={(row:any)=>{onChange({...value,contentId:row.id});setLabel(row.titleZh||row.title||row.name||'已选择');setOpen(false)}}/>}</>;
}
