import {ActionView} from './interaction';
import {pageBehavior,privacyChoice} from '../lib/behavior';
import { useEffect, useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Image, Text } from '@tarojs/components';
import { configuration, image } from '../lib/api';
import { navigation, destinationUrl } from '../lib/domain.mjs';
import Floating from './floating';
export default function GlobalNavigation({active='', config:provided, onChange, hidden=false, floating=true}: {active?:string;config?:any;onChange?:(target:string)=>void;hidden?:boolean;floating?:boolean}) {
  const [config,setConfig]=useState<any>(provided), [keyboard,setKeyboard]=useState(false);
  async function load(){if(provided){setConfig(provided);return;}try{setConfig((await configuration()).data)}catch{/* A failed configuration cannot safely invent navigation. */}}
  useEffect(()=>{void load()},[provided]);
  useDidShow(()=>{pageBehavior(active);if(!provided)void load()});
  useEffect(()=>{pageBehavior(active)},[active]);
  useEffect(()=>{const handler=(e:{height:number})=>setKeyboard(e.height>0);Taro.onKeyboardHeightChange(handler);return()=>Taro.offKeyboardHeightChange(handler)},[]);
  const items=config?.mini?navigation(config.mini.navigation):[];
  if(hidden||!config)return null;
  function change(target:string){if(onChange){onChange(target);return;}void Taro.reLaunch({url:destinationUrl({target})})}
  return <><ActionView style={{textAlign:'right',fontSize:'22rpx',padding:'8rpx 24rpx',color:'#6b786e'}} onClick={()=>void privacyChoice()}>隐私设置 · 匿名统计</ActionView>{!provided&&floating&&<Floating entries={config.floating||[]} path={'/'+(Taro.getCurrentInstance().router?.path?.replace(/^\//,'').split('/')[1]||active)} raised={/pages\/(checkout|cart)\//.test(Taro.getCurrentInstance().router?.path||'')}/>}{!keyboard&&items.length>0&&<View className="bottom-nav">{items.map((entry:any)=>{
    const icon=active===entry.target?(entry.selectedIconId||entry.iconId):entry.iconId;
    return <ActionView key={entry.target} className={active===entry.target?'active':''} onClick={()=>change(entry.target)} role="button" ariaLabel={entry.label}>
      {icon?<Image src={image(icon)+'?v='+encodeURIComponent(config.revision||'')} mode="aspectFit"/>:<View className="nav-dot"/>}<Text>{entry.label}</Text>
    </ActionView>;
  })}</View>}</>;
}
