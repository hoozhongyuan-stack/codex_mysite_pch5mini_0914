import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, useLoad, usePullDownRefresh, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { useState } from 'react';
import { ActionButton } from '../../components/interaction';
import Floating from '../../components/floating';
import GlobalNavigation from '../../components/global-navigation';
import MiniPageComponents from '../../components/mini-page-components';
import { configuration } from '../../lib/api';
import { destinationUrl } from '../../lib/domain.mjs';
import { homeShare } from '../../lib/share.mjs';

export default function CustomPage() {
  const [id,setId]=useState(''),[config,setConfig]=useState<any>(null),[page,setPage]=useState<any>(null),[error,setError]=useState('');
  useShareAppMessage(homeShare);
  useShareTimeline(homeShare);
  useLoad((params)=>setId(String(params.id||'')));
  async function load(){
    setError('');
    try{
      const result=await configuration();
      const found=(result.data?.mini?.microPages||[]).find((row:any)=>row.id===id&&row.status==='published');
      setConfig(result.data);setPage(found||null);
      if(found)void Taro.setNavigationBarTitle({title:found.title||'微页面'});
      else setError('页面暂未发布或已下架');
    }catch(e){setError((e as Error).message)}
  }
  useDidShow(()=>{void load()});
  usePullDownRefresh(()=>{void load().finally(()=>Taro.stopPullDownRefresh())});
  function openLink(value:any){try{void Taro.navigateTo({url:destinationUrl(value)})}catch(e){void Taro.showToast({title:(e as Error).message,icon:'none'})}}
  return <View className="shell has-nav"><View className="content">
    {error?<View className="empty"><Text>{error}</Text><ActionButton onClick={load}>重新加载</ActionButton></View>:page?<><Text className="page-title">{page.title}</Text>{page.description&&<Text className="intro">{page.description}</Text>}<MiniPageComponents components={page.components||[]} onOpen={openLink}/></>:<View className="empty">正在读取页面…</View>}
  </View>{config&&<Floating entries={config.floating} path={'/custom/'+id}/>}<GlobalNavigation active={'microPage:'+id} config={config}/></View>;
}
