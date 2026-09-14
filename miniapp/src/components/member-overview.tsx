import {ActionButton,ActionText,ActionView} from './interaction';
import {View,Text,Button} from '@tarojs/components';
import {memberName} from '../lib/member.mjs';
export default function MemberOverview({user,points,onOpen,onLogin,onShop}:any){
 return <View className="member-overview"><View className="member-profile"><View className="member-avatar">{user?memberName(user).slice(0,1):'客'}</View><View><Text className="member-caption">{user?'欢迎回来':'随心浏览，发现好物'}</Text><Text className="member-name">{memberName(user)}</Text>{!user&&<ActionButton size="mini" onClick={onLogin}>登录 / 注册</ActionButton>}</View>{user&&<ActionText className="member-setting" onClick={()=>onOpen('settings')}>设置</ActionText>}</View>
 <View className="member-balance"><View><Text className="member-caption">可用积分</Text><Text className="member-number">{user?points?.balance??'—':'登录后查看'}</Text></View><ActionButton size="mini" onClick={onShop}>去兑换</ActionButton></View>
 <View className="member-section-title"><Text>我的订单</Text><ActionText onClick={()=>onOpen('orders')}>全部订单 ›</ActionText></View>
 <View className="member-order-shortcuts">{[['pending_payment','待付款'],['pending_review','待审核'],['pending_ship','待发货'],['pending_receive','待收货']].map(([k,l])=><ActionView key={k} onClick={()=>onOpen('orders',k)}><View className={"member-order-icon icon-"+k}/><Text>{l}</Text></ActionView>)}</View>
 <View className="member-services">{[['favorites','我的收藏'],['points','我的积分'],['activities','我的活动'],['addresses','我的地址'],['history','最近观看'],['settings','账户设置']].map(([k,l])=><ActionView key={k} onClick={()=>onOpen(k)}><Text>{l}</Text><Text>›</Text></ActionView>)}</View>
 </View>
}
