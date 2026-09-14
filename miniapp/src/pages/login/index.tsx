import {View} from '@tarojs/components';
import GlobalNavigation from '../../components/global-navigation';
import AccountContent from '../../components/account-content';
export default function LoginPage(){return <View className='has-nav'><AccountContent initialScreen='login'/><GlobalNavigation active='account'/></View>}
