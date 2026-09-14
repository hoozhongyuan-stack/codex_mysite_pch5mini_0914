import {View,Text} from '@tarojs/components';
/** Stable first-load space; refreshes keep existing content visible. */
export default function LoadingState({refresh=false,detail=false}:{refresh?:boolean;detail?:boolean}) {
  if(refresh)return <View className="refresh-status" ariaLabel="正在更新内容"><Text>正在更新，保留上次内容…</Text></View>;
  return <View className={'loading-skeleton '+(detail?'loading-detail':'')} ariaLabel="正在加载内容">
    <View className="loading-block"/><View className="loading-line"/><View className="loading-line short"/>
    {!detail&&<View className="loading-block"/>}<Text className="refresh-status">正在加载…</Text>
  </View>;
}
