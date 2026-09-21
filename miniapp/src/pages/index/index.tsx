import {ActionButton,ActionView} from '../../components/interaction';
import LoadingState from '../../components/loading-state';
import Account from '../../components/account-content';
import { useState, useEffect } from 'react';
import Taro, { useDidShow, useLoad, usePullDownRefresh, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import {
  View,
  Text,
  Image,
  Swiper,
  SwiperItem,
  Button,
} from '@tarojs/components';
import { configuration, image, request } from '../../lib/api';
import { navigation, destinationUrl } from '../../lib/domain.mjs';
import Catalog, { Cards } from '../../components/catalog';
import Floating from '../../components/floating';
import GlobalNavigation from '../../components/global-navigation';
import { homeShare } from '../../lib/share.mjs';
const labels: Record<string, string> = {
  home: '首页',
  products: '商品',
  articles: '文章',
  points: '积分商城',
  account: '个人中心',
};
export default function Index() {
  const [config, setConfig] = useState<any>(null),
    [target, setTarget] = useState('home'),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [cached, setCached] = useState(false),[refreshVersion,setRefreshVersion]=useState(0);
  useShareAppMessage(homeShare);
  useShareTimeline(homeShare);
  useLoad(p=>{if(p.target && labels[p.target])setTarget(p.target)});
  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await configuration();
      setConfig(result.data);
      setCached(result.cached);setRefreshVersion(v=>v+1);
      if (result.data) {
        const nav = navigation(result.data.mini.navigation);
        // Direct links remain accessible even when absent from bottom navigation.
        if (result.data.mini.productFloor?.enabled !== false) {
          const list = await request('/api/mini/catalog?kind=products&featured=1');
          setRows(list.rows);
        } else setRows([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  usePullDownRefresh(()=>{void load().finally(()=>Taro.stopPullDownRefresh())});
  useDidShow(() => {
    void load();
  });
  useEffect(()=>{void Taro.setNavigationBarTitle({title:target==='home'?(config?.brand?.name||'首页'):labels[target]||'首页'})},[target,config?.brand?.name]);
  const nav = config ? navigation(config.mini.navigation) : [];
  const change = (next: string) => {
    if (['cart','videos','events','salons'].includes(next)) {void Taro.reLaunch({url:destinationUrl({target:next})});return;}
    if (!labels[next]) return;
    setTarget(next);
    void Taro.pageScrollTo({ scrollTop: 0, duration: 0 });
  };
  function openLink(value:any) {
    try {
      if(labels[value.target]){change(value.target);return;}
      void Taro.navigateTo({url:destinationUrl(value)}).catch(()=>Taro.showToast({title:'页面暂不可用，请返回重试',icon:'none'}));
    }catch(e){void Taro.showToast({title:(e as Error).message,icon:'none'});}
  }
  if (loading && !config) return <View className="content has-nav"><LoadingState detail/><GlobalNavigation active={target}/></View>;
  if (!config)
    return (
      <View className="empty">
        <Text>{error || '小程序尚未开放'}</Text>
        <ActionButton onClick={load}>重新加载</ActionButton>
      </View>
    );
  return (
    <View className={'shell ' + (nav.length ? 'has-nav' : '')}>
      {cached && (
        <View className="notice">网络暂不可用，正在显示上次的页面配置</View>
      )}
      {error && (
        <ActionView className="notice" onClick={load}>
          {error} · 点击重试
        </ActionView>
      )}
      <View className={target === 'account' ? '' : 'content'}>
        {target === 'account' ? (
          <Account embedded onShop={()=>change('points')}/>
        ) : target === 'home' ? (
          <>
            <Text className="eyebrow">{config.brand?.name}</Text>
            <Text className="headline">{config.mini.title || '欢迎光临'}</Text>
            {config.mini.description && (
              <Text className="intro">{config.mini.description}</Text>
            )}
            {config.mini.banners.length > 0 && (
              <Swiper
                className="banners"
                indicatorDots
                autoplay
                circular={config.mini.banners.length > 1}
              >
                {config.mini.banners.map((b: any) => (
                  <SwiperItem key={b.imageId}>
                    <ActionView onClick={() => openLink(b)}>
                      <Image src={image(b.imageId,'hero')+'&v='+encodeURIComponent(config.revision||'')} mode="aspectFill" lazyLoad />
                      <Text>{b.title}</Text>
                    </ActionView>
                  </SwiperItem>
                ))}
              </Swiper>
            )}
            {(config.mini.hotspotImages || []).map((b:any,i:number)=><View key={i} style={{position:'relative',marginBottom:'24px'}}>
              <Image src={image(b.imageId,'hero')+'&v='+encodeURIComponent(config.revision||'')} mode="widthFix" style={{width:'100%',display:'block'}} lazyLoad/>
              {b.zones.map((z:any,j:number)=><ActionView key={j} ariaLabel={z.label} role="button" style={{position:'absolute',left:z.x+'%',top:z.y+'%',width:z.width+'%',height:z.height+'%'}} onClick={()=>openLink(z)}/>)}</View>)}
            <View className='home-quick-links'>{nav.filter((n:any)=>['products','articles'].includes(n.target)).map((n:any)=><ActionView key={n.target} onClick={()=>change(n.target)}>{n.iconId&&<Image src={image(n.iconId,'thumb')} mode='aspectFit' lazyLoad/>}<Text>{n.label} ›</Text></ActionView>)}</View>
            {rows.length > 0 && (
              <>
                <Text className="section-title">{config.mini.productFloor?.title || '精选商品'}</Text>
                <Cards rows={rows} />
              </>
            )}
            {!rows.length && !config.mini.banners.length && !config.mini.hotspotImages?.length && (
              <View className="empty">暂无推荐内容</View>
            )}
          </>
        ) : (
          <>

            <Catalog key={target} kind={target} refreshVersion={refreshVersion} />
          </>
        )}
      </View>
      <Floating
        entries={config.floating}
        path={target === 'home' ? '/' : '/' + target}
      />
      <GlobalNavigation active={target} config={config} onChange={change}/>

    </View>
  );
}
