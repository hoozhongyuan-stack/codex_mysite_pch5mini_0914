import Taro from '@tarojs/taro';
import {origin} from './api';
export const choiceKey='geo-behavior-choice-v1';
const randomId=()=>Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join('');
let lastPage='',lastAt=0;
export function behavior(event:string,target?:string){try{
 if(Taro.getStorageSync(choiceKey)!=='accepted'||!origin)return;
 let visitorId=Taro.getStorageSync('behavior-visitor');if(!visitorId){visitorId=randomId();Taro.setStorageSync('behavior-visitor',visitorId);}
 let session=Taro.getStorageSync('behavior-session');if(!session||Date.now()-session.at>1800000)session={id:randomId()};session={...session,at:Date.now()};Taro.setStorageSync('behavior-session',session);
 const path='/'+(Taro.getCurrentInstance().router?.path||'pages/index/index').replace(/^\//,'').split('?')[0];
 void Taro.request({url:origin+'/api/mini/behavior',method:'POST',data:{id:randomId(),visitorId,sessionId:session.id,event,path,target,consent:true,channel:'mini'},header:{'Content-Type':'application/json'},timeout:5000}).catch(()=>{});
}catch{/* Optional telemetry never blocks the app. */}}
export function pageBehavior(target=''){const route=Taro.getCurrentInstance().router;const path=route?.path||'';target=/^\/?pages\/(detail|videos|salons)\/index$/.test(path)?route?.params?.id||target:target;const key=path+':'+target;try{if(Taro.getStorageSync(choiceKey)!=='accepted')return;if(key!==lastPage||Date.now()-lastAt>1800000){behavior('page_view',target||undefined);lastPage=key;lastAt=Date.now();}}catch{}}
export async function privacyChoice(){try{const accepted=Taro.getStorageSync(choiceKey)==='accepted';const result=await Taro.showModal({title:'匿名使用统计',content:'可选记录浏览、阅读、视频观看、收藏及购物步骤，帮助改善体验。不包含账号、表单内容或订单编号；不影响浏览和购买，随时可关闭。当前：'+(accepted?'已开启':'已关闭'),confirmText:accepted?'关闭统计':'允许统计',cancelText:'保持现状'});if(result.confirm){Taro.setStorageSync(choiceKey,accepted?'necessary':'accepted');if(accepted){Taro.removeStorageSync('behavior-visitor');Taro.removeStorageSync('behavior-session');lastPage='';}else pageBehavior();}}catch{}}
