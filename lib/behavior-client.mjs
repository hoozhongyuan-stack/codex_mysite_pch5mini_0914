// Shared by browser and mini-program. Seek jumps and hidden/paused time do not count.
export function playbackCounter() {
  let previous=null,total=0,ranges=[];const emitted=new Set();
  const coverage=()=>ranges.reduce((sum,[a,b])=>sum+b-a,0);
  function include(a,b){const merged=[];for(const interval of [...ranges,[a,b]].sort((x,y)=>x[0]-y[0])){const last=merged.at(-1);if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else merged.push([...interval]);}ranges=merged;}
  return {seconds:()=>total,coverage,tick(position,duration,now,playing){
    const events=[];
    if(previous&&playing&&previous.playing){const elapsed=(now-previous.now)/1000,delta=position-previous.position;if(elapsed>0&&elapsed<=3&&delta>0&&delta<=elapsed*2.5+0.2){total+=Math.min(delta,elapsed);include(Math.max(0,previous.position),Math.min(duration,position));}}
    previous={position,now,playing};
    for(const [event,ready] of [['video_start',total>0],['video_valid',total>=10],['video_complete',duration>0&&coverage()>=duration*0.9]])if(ready&&!emitted.has(event)){emitted.add(event);events.push(String(event));}
    return events;
  }};
}
export const behaviorChoiceKey='geo-behavior-choice-v1';
