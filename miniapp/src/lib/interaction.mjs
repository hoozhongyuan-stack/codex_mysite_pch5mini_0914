/** Shared visual and event gate; native disabled/open-type behavior stays intact. */
export function interactionState({disabled=false,loading=false,className=''},pressed=false){
 const blocked=Boolean(disabled||loading);
 return {blocked,className:[className,'interaction-target',blocked?'interaction-disabled':'',loading?'interaction-loading':'',pressed&&!blocked?'interaction-pressed':''].filter(Boolean).join(' ')};
}
