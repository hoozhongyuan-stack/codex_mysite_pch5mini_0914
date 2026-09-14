import {ActionButton} from './interaction';
import {behavior} from '../lib/behavior';
import {useEffect,useState,useRef} from 'react';
import Taro,{useDidShow} from '@tarojs/taro';
import {View,Button} from '@tarojs/components';
import {request,token} from '../lib/api';
export default function MediaInteractions({kind,id,parentId}:{kind:string;id:string;parentId?:string}){
 const pending=useRef(''),actor=useRef(token()),lock=useRef(false);
 const [state,setState]=useState<any>({}),[busy,setBusy]=useState(false);
 const endpoint='/api/mini/media?kind='+kind;
 async function refresh(){const session=token();setState({});if(!session)return;try{const result=await request(endpoint+'&action=state&id='+id,undefined,session);if(session===token())setState(result)}catch{}}
 useEffect(()=>{pending.current='';void refresh()},[id]);
 useDidShow(()=>{if(actor.current!==token()){actor.current=token();setState({});lock.current=false;setBusy(false);void refresh()}const action=pending.current;pending.current='';if(action&&token())void act(action)});
 async function act(action:string){
  const session=token();
  if(!session){pending.current=action;await Taro.navigateTo({url:'/pages/login/index'});return;}
  if(lock.current)return;lock.current=true;setBusy(true);
  try{const adding=action==='favorite'&&!state.actions?.includes(action);await request(endpoint+'&action=interact',{id,parentId,action,active:action==='share'||!state.actions?.includes(action)},session);if(adding)behavior('favorite',id);const result=await request(endpoint+'&action=state&id='+id,undefined,session);if(token()===session)setState(result)}
  catch(e){if(session===token())void Taro.showToast({title:(e as Error).message,icon:'none'})}
  finally{if(session===token()){lock.current=false;setBusy(false)}}
 }
 return <View className="media-interactions"><ActionButton openType="share" onClick={()=>{if(token())void act('share')}}>转发</ActionButton><ActionButton disabled={busy} onClick={()=>act('like')}>{state.actions?.includes('like')?'已点赞':'点赞'}</ActionButton><ActionButton disabled={busy} onClick={()=>act('favorite')}>{state.actions?.includes('favorite')?'已收藏':'收藏'}</ActionButton></View>
}
