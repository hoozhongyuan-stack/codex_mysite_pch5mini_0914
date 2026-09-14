import {ActionView} from './interaction';
import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Image, Text, ScrollView } from '@tarojs/components';
import { visibleFloating } from '../lib/domain.mjs';
import { image, request } from '../lib/api';
import FormContent from './form-content';
export default function Floating({entries,path,hidden=false,raised=false}: {entries:any[];path:string;hidden?:boolean;raised?:boolean}) {
  const [keyboard,setKeyboard]=useState(false), [busy,setBusy]=useState(false),
    [opened,setOpened]=useState<any>(null), [unavailable,setUnavailable]=useState<string[]>([]);
  useEffect(()=>{
    const listener=(r:{height:number})=>setKeyboard(r.height>0);
    Taro.onKeyboardHeightChange(listener);return()=>Taro.offKeyboardHeightChange(listener);
  },[]);
  useEffect(()=>{
    let disposed=false;
    const forms=visibleFloating(entries,path).filter((e:any)=>e.kind==='form');
    void Promise.all(forms.map(async(e:any)=>{try{await request('/api/mini/member/form?id='+encodeURIComponent(e.formId));return ''}catch(error){return (error as Error).message==='表单未开放'?e.id:''}}))
      .then(ids=>{if(!disposed)setUnavailable(ids.filter(Boolean))});
    return()=>{disposed=true};
  },[entries,path]);
  useEffect(()=>{setOpened(null)},[path]);
  async function act(entry:any){
    if(busy)return;
    if(entry.kind==='image'||entry.kind==='form'){setOpened(entry);return;}
    setBusy(true);
    try{await Taro.makePhoneCall({phoneNumber:entry.phone.replace(/[ ()-]/g,'')})}
    catch(err){if(!/cancel/i.test(String((err as any)?.errMsg)))void Taro.showToast({title:'暂时无法拨号，请重试',icon:'none'})}
    finally{setBusy(false)}
  }
  if(hidden)return null;
  if(opened)return <View className="float-modal-mask" onClick={()=>setOpened(null)}>
    <View className={'float-modal '+(opened.kind==='form'?'form-modal':'image-modal')} onClick={e=>e.stopPropagation()}>
      <View className="float-modal-heading"><Text>{opened.labelZh}</Text><ActionView className="modal-close" role="button" ariaLabel="关闭" onClick={()=>setOpened(null)}>×</ActionView></View>
      {opened.kind==='image'?<Image className="float-modal-image" src={image(opened.imageId)} mode="aspectFit"/>:
        <ScrollView scrollY className="float-form-scroll"><FormContent id={opened.formId} source={path} embedded/></ScrollView>}
    </View>
  </View>;
  if(keyboard||busy)return null;
  return <View className={'floating '+(raised?'floating-raised':'')}>
    {visibleFloating(entries,path).filter((e:any)=>!unavailable.includes(e.id)).map((entry:any)=><ActionView className="float-button" key={entry.id} onClick={()=>void act(entry)} ariaLabel={entry.labelZh}>
      {entry.iconId?<Image src={image(entry.iconId)} mode="aspectFit"/>:<Text className="float-symbol">{entry.kind==='phone'?'☎':entry.kind==='image'?'▧':'☷'}</Text>}
      <Text>{entry.labelZh}</Text>
    </ActionView>)}
  </View>;
}
