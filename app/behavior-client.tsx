'use client';
import { useEffect } from 'react';
import { behaviorChoiceKey, playbackCounter } from '@/lib/behavior-client.mjs';
export { behaviorChoiceKey };
export function behavior(event:string,target?:string){
 try{
  if(localStorage.getItem(behaviorChoiceKey)!=='accepted')return;
  const path=location.pathname.replace(/(\/(?:zh|en)\/orders)\/.*$/,'$1');if(/^\/(admin|manage|login|api)(\/|$)/.test(path))return;
  if(event==='page_view'&&/^\/(zh|en)\/(account|orders)(\/|$)/.test(path))return;
  let visitorId=localStorage.getItem('geo-behavior-visitor');if(!visitorId){visitorId=crypto.randomUUID();localStorage.setItem('geo-behavior-visitor',visitorId);}
  let session=JSON.parse(sessionStorage.getItem('geo-behavior-session')||'null');if(!session||Date.now()-session.at>1800000)session={id:crypto.randomUUID()};session.at=Date.now();sessionStorage.setItem('geo-behavior-session',JSON.stringify(session));
  const query=String(location.search||'');
  const shareRef=(typeof URLSearchParams==='function' ? new URLSearchParams(query).get('share') : (query.match(/[?&]share=([a-z0-9]{24})(?:&|$)/)||[])[1])||'';
  void fetch('/api/behavior',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),visitorId,sessionId:session.id,event,path,target,shareRef,consent:true,channel:'website'}),keepalive:true}).catch(()=>{});
 }catch{/* Optional statistics must never affect the customer journey. */}
}
let lastPage='',lastPageAt=0;
export function observeBehavior(){const page=location.pathname;if(lastPage!==page||Date.now()-lastPageAt>1800000){behavior('page_view');try{if(localStorage.getItem(behaviorChoiceKey)==='accepted'){lastPage=page;lastPageAt=Date.now();}}catch{}}}
export function ArticleRead({id}:{id:string}){
 useEffect(()=>{let visible=0,last=Date.now(),sent=false;const timer=setInterval(()=>{const now=Date.now();if(!document.hidden){try{if(localStorage.getItem(behaviorChoiceKey)==='accepted')visible+=Math.min(now-last,1500);else visible=0;}catch{}}last=now;if(!sent&&visible>=10000){sent=true;behavior('article_read',id);}},1000);return()=>clearInterval(timer);},[id]);return null;
}
export function observeVideo(video:HTMLVideoElement,target:string){
 let counter=playbackCounter();
 const sample=(playing=!video.paused&&!video.seeking)=>{try{if(localStorage.getItem(behaviorChoiceKey)!=='accepted'){counter=playbackCounter();return;}counter.tick(video.currentTime,video.duration,Date.now(),playing&&!document.hidden).forEach(event=>behavior(event,target));}catch{}};
 const play=()=>sample(true),pause=()=>{sample(true);sample(false);},ended=()=>sample(true);
 video.addEventListener('playing',play);video.addEventListener('pause',pause);video.addEventListener('ended',ended);
 const timer=setInterval(()=>sample(),1000);
 return()=>{clearInterval(timer);video.removeEventListener('playing',play);video.removeEventListener('pause',pause);video.removeEventListener('ended',ended);};
}
