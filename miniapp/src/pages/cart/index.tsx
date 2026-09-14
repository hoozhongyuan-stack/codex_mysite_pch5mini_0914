import Taro from '@tarojs/taro';
import {View,Text} from '@tarojs/components';
import CartContent from '../../components/cart-content';
import GlobalNavigation from '../../components/global-navigation';
import {origin,token} from '../../lib/api';
export default function Cart(){
  return <View className="content has-nav"><Text className="page-title">购物车</Text><CartContent onCheckout={lines=>{
    Taro.setStorageSync('mini-cart-checkout:'+origin+':'+token(),lines);
    void Taro.navigateTo({url:'/pages/checkout/index?mode=cart&selection=1'});
  }}/><GlobalNavigation active="cart"/></View>;
}
