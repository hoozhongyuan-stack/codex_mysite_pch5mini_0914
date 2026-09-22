import Taro from '@tarojs/taro';
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import { ActionView } from './interaction';
import { Cards } from './catalog';
import { destinationUrl } from '../lib/domain.mjs';
import { image, request } from '../lib/api';

function ProductFloor({ row }: { row: any }) {
  const ids = useMemo(() => (row.productIds || []).filter(Boolean).slice(0, 12), [row.productIds]);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    if (!ids.length) {
      setItems([]);
      return () => {
        active = false;
      };
    }
    request('/api/mini/catalog?kind=products&ids=' + encodeURIComponent(ids.join(',')))
      .then((result) => {
        if (active) setItems(result.rows || []);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [ids.join(',')]);
  if (!ids.length || (!items.length && !error)) return null;
  return <View className="mini-decor-product-floor">
    <Text className="section-title">{row.title || '精选商品'}</Text>
    {error ? <View className="catalog-empty"><Text>{error}</Text></View> : <Cards rows={items} />}
  </View>;
}

export default function MiniPageComponents({components=[],onOpen}: {components?:any[];onOpen?:(value:any)=>void}) {
  const open=(value:any)=>{
    if(!value?.target)return;
    if(onOpen){onOpen(value);return;}
    try{void Taro.navigateTo({url:destinationUrl(value)})}catch(e){void Taro.showToast({title:(e as Error).message,icon:'none'})}
  };
  return <>
    {components.filter((row:any)=>row.enabled!==false).map((row:any)=>{
      if(row.type==='search')return <ActionView key={row.id} className="mini-decor-search" onClick={()=>open({target:row.scope||'products'})} role="button" ariaLabel={row.placeholder||'搜索'}><Text>{row.placeholder||'搜索内容'}</Text><Text>搜索</Text></ActionView>;
      if(row.type==='notice')return <ActionView key={row.id} className="mini-decor-notice" onClick={()=>open(row)} role="button" ariaLabel={row.text||'公告'}><Text>{row.text||'公告内容'}</Text>{row.target&&<Text>›</Text>}</ActionView>;
      if(row.type==='divider')return <View key={row.id} className={'mini-decor-divider '+(row.style||'line')} />;
      if(row.type==='banners'&&(row.items||[]).length>0)return <Swiper key={row.id} className="banners mini-decor-banners" indicatorDots autoplay circular={(row.items||[]).length>1}>{row.items.map((b:any,index:number)=><SwiperItem key={(b.imageId||'banner')+index}><ActionView onClick={()=>open(b)}><Image src={image(b.imageId,'hero')} mode="aspectFill" lazyLoad />{b.title&&<Text>{b.title}</Text>}</ActionView></SwiperItem>)}</Swiper>;
      if(row.type==='hotspots')return <View key={row.id} className="mini-decor-hotspots">{(row.items||[]).map((b:any,i:number)=><View key={i} className="mini-hotspot-frame"><Image src={image(b.imageId,'hero')} mode="widthFix" lazyLoad />{(b.zones||[]).map((z:any,j:number)=><ActionView key={j} ariaLabel={z.label} role="button" style={{position:'absolute',left:z.x+'%',top:z.y+'%',width:z.width+'%',height:z.height+'%'}} onClick={()=>open(z)}/>)}</View>)}</View>;
      if(row.type==='productFloor')return <ProductFloor key={row.id} row={row}/>;
      return null;
    })}
  </>;
}
