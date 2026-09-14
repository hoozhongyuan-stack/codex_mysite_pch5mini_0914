'use client';
import { useState } from 'react';
import { Film, Play } from 'lucide-react';
export function sourcePreviewUrl(id: string) {
  return '/api/video/admin-source-preview?id=' + encodeURIComponent(id);
}
export default function SourceThumbnail({source}: any) {
  const [failed,setFailed]=useState(false);
  const [duration,setDuration]=useState('');
  return <>
    {failed ? <span className="source-thumb-fallback"><Film size={28}/><small>暂无法生成预览</small></span> :
      <video muted playsInline preload="metadata" src={sourcePreviewUrl(source.id)+'#t=0.1'}
        onError={()=>setFailed(true)} onLoadedMetadata={e=>{
          const seconds=e.currentTarget.duration;
          if(Number.isFinite(seconds))setDuration(Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0'));
        }}/>
    }
    <span className="source-play-mark"><Play size={16}/></span>
    {duration&&<span className="source-duration">{duration}</span>}
  </>;
}
