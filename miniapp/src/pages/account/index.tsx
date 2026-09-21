import {View} from '@tarojs/components';
import GlobalNavigation from '../../components/global-navigation';
import {useState} from 'react';
import {useLoad} from '@tarojs/taro';
import AccountContent from '../../components/account-content';
export default function AccountPage(){
 const [entry,setEntry]=useState<{section:string;status:string;returnTo:string}|null>(null);
 useLoad(p=>setEntry({section:['orders','points','addresses','favorites','activities','history','settings'].includes(p.section)?p.section:'overview',status:p.status||'',returnTo:p.returnTo==='checkout'?'checkout':''}));
 return <View className="has-nav">{entry&&<AccountContent initialScreen={entry.section} initialFilter={entry.status} returnTo={entry.returnTo}/>}<GlobalNavigation active="account"/></View>;
}
