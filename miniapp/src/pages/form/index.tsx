import {useState} from 'react';
import {useLoad} from '@tarojs/taro';
import {View} from '@tarojs/components';
import FormContent from '../../components/form-content';
import GlobalNavigation from '../../components/global-navigation';
export default function FormPage(){
 const [params,setParams]=useState({id:'',source:''});
 useLoad(p=>setParams({id:p.id||'',source:p.source||''}));
 return <View className="has-nav">{params.id&&<FormContent id={params.id} source={params.source}/>}<GlobalNavigation/></View>;
}
