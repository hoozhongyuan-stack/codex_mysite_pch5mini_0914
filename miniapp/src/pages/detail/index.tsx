import {ActionButton,ActionView} from '../../components/interaction';
import './detail-sample.scss';
import {behavior,choiceKey} from '../../lib/behavior';
import { useEffect, useRef, useState } from 'react';
import Taro, { useLoad, useDidShow, useShareAppMessage, useDidHide } from '@tarojs/taro';
import { View, Text, Image, Button, Picker } from '@tarojs/components';
import { request, image, configuration, token } from '../../lib/api';
import Floating from '../../components/floating';
import RichBody from '../../components/rich-body';
import GlobalNavigation from '../../components/global-navigation';
import { guestCart } from '../../lib/cart-storage';
import { publicationLabel } from '../../../../lib/mini-content.mjs';
import { cartQuantity } from '../../lib/cart.mjs';
export default function Detail() {
  const [item,setItem]=useState<any>(null), [error,setError]=useState(''),
    [loading,setLoading]=useState(true), [loadError,setLoadError]=useState(''),
    [imageError,setImageError]=useState(false), [imageAttempt,setImageAttempt]=useState(0),
    [floating,setFloating]=useState<any[]>([]), [mode,setMode]=useState('cash'),
    [variantIndex,setVariantIndex]=useState(0), [quantity,setQuantity]=useState('1'),
    [cartCount,setCartCount]=useState(0), [actions,setActions]=useState<string[]>([]), [busy,setBusy]=useState(false), [fullscreen,setFullscreen]=useState(false);
  const visible=useRef(true);useDidShow(()=>{visible.current=true});useDidHide(()=>{visible.current=false});
  useEffect(()=>{if(item?.kind!=='articles')return;let elapsed=0;const timer=setInterval(()=>{if(visible.current&&Taro.getStorageSync(choiceKey)==='accepted')elapsed++;if(elapsed>=10){behavior('article_read',item.id);clearInterval(timer);}},1000);return()=>clearInterval(timer);},[item?.id]);
  const pending=useRef<{action:string;active:boolean}|null>(null), lock=useRef(false);
  const kind=item?.kind==='articles'?'article':'product';
  async function state(content:any){
    const session=token();
    if(!session){setActions([]);return;}
    try {const result=await request('/api/mini/interaction?kind='+(content.kind==='articles'?'article':'product')+'&id='+encodeURIComponent(content.id),undefined,session);if(token()===session)setActions(result.actions||[])}
    catch(e){if(token()===session)setError((e as Error).message)}
  }
  const contentRequest=useRef({kind:'products',id:''});
  const fetchLock=useRef(false);
  async function loadContent(){
    if(fetchLock.current)return;
    fetchLock.current=true;setLoading(true);setLoadError('');
    try {
      const params=contentRequest.current;
      const result=await request('/api/mini/catalog?kind='+encodeURIComponent(params.kind)+'&id='+encodeURIComponent(params.id));
      if(!result.item)throw Error('内容暂不可用，请稍后重试');
      setItem(result.item);void state(result.item);
      void Taro.setNavigationBarTitle({title:result.item.kind==='articles'?'文章详情':'商品详情'});
    }catch(e){setLoadError((e as Error).message||'加载失败，请稍后重试')}
    finally{fetchLock.current=false;setLoading(false)}
  }
  useLoad(params=>{
    setMode(params.mode||'cash');
    contentRequest.current={kind:params.kind||'products',id:params.id||''};
    void loadContent();
    void configuration().then(c=>setFloating(c.data?.floating||[])).catch(()=>setFloating([]));
  });
  const variants = item?.variants?.filter((v:any) =>
    mode === 'points' ? v.pointsPrice > 0 : v.priceMinor !== null
  ) || [];
  const selectedVariant = variants[variantIndex];
  const hasVariants = item?.kind === 'products' && variants.length > 0;
  const variantKey = hasVariants ? (selectedVariant?.key || '') : '';
  function normalizeQuantity(next: string) {
    try {
      return String(cartQuantity(next));
    } catch {
      return '1';
    }
  }
  useEffect(() => {
    if (!hasVariants) return;
    setVariantIndex((i) => Math.max(0, Math.min(i, variants.length - 1)));
  }, [hasVariants, variants.length]);
  useEffect(() => {
    if (!item?.kind) return;
    setQuantity((current) => normalizeQuantity(current));
  }, [item?.kind]);
  useDidShow(()=>{
    const current=token();
    if(current)void request('/api/mini/member/cart').then(r=>{if(token()===current)setCartCount((r.rows||[]).reduce((n:number,r:any)=>n+r.quantity,0))}).catch(()=>setCartCount(0));
    else setCartCount(guestCart().reduce((n:number,r:any)=>n+r.quantity,0));
    if(!item){if(pending.current&&token())pending.current=null;return;}
    if(pending.current&&token()){const next=pending.current;pending.current=null;void interact(next.action,next.active)}
    else {pending.current=null;void state(item)}
  });
  useShareAppMessage(()=>({title:item?.title||'分享内容',path:'/pages/detail/index?kind='+(item?.kind||'articles')+'&id='+encodeURIComponent(item?.id||'')+'&mode='+mode}));
  async function interact(action:string,active=true){
    if(!item||lock.current)return;
    if(!token()){
      if(action==='share')return;
      pending.current={action,active};
      const result=await Taro.showModal({title:'登录后继续',content:action==='like'?'登录后即可点赞这篇内容':'登录后即可将内容加入收藏',confirmText:'去登录',cancelText:'继续浏览'});
      if(result.confirm)await Taro.navigateTo({url:'/pages/login/index'});else pending.current=null;
      return;
    }
    const session=token();
    lock.current=true;setBusy(true);setError('');
    try {
      const r=await request('/api/mini/interaction',{kind,id:item.id,action,active},session);
      if(action==='favorite'&&r.active)behavior('favorite',item.id);
      setActions(previous=>r.active?[...new Set([...previous,action])]:previous.filter(a=>a!==action));
      if(r.earned>0)void Taro.showToast({title:'获得 '+r.earned+' 积分',icon:'none'});
    }catch(e){if(token()===session)setError((e as Error).message)}finally{lock.current=false;setBusy(false)}
  }
  const active=item?.kind==='articles'?'articles':mode==='points'?'points':'products';
  return <View className={"detail has-nav detail-sample"+(mode==='points'?' points-detail':'')}>
    {!item?(loading?<View className="detail-loading" ariaLabel="正在加载详情">
      <View className="detail-skeleton detail-skeleton-media"/>
      <View className="content"><View className="detail-skeleton detail-skeleton-title"/><View className="detail-skeleton detail-skeleton-line"/><View className="detail-skeleton detail-skeleton-line short"/><Text className="detail-loading-label">正在加载详情…</Text></View>
    </View>:<View className="detail-load-error"><Text>暂时无法加载内容</Text><Text className="detail-error-message">{loadError}</Text><ActionButton  onClick={()=>void loadContent()}>重新加载</ActionButton></View>):<>
      {item.imageId&&<View className="detail-media">
        {imageError?<View className="detail-image-error"><Text>图片暂未加载</Text><ActionButton  onClick={()=>{setImageAttempt(value=>value+1);setImageError(false)}}>重试图片</ActionButton></View>:<Image key={imageAttempt} className="hero" mode="aspectFit" src={image(item.imageId)} onError={()=>setImageError(true)} ariaLabel={item.title}/>}
      </View>}
      <View className="content">
        <Text className="page-title">{item.title}</Text>
        {item.kind==='articles'&&<View className="article-meta">{item.author&&<Text>{item.author}</Text>}<Text>{publicationLabel(item.publishedAt)?'发布于 '+publicationLabel(item.publishedAt):'发布时间待补充'}</Text></View>}
        <Text className="intro">{item.summary}</Text>
        {error&&<View className="notice">{error}</View>}
        {item.kind==='products'&&<View className="product-purchase-inline">
          <View className="product-price-row"><Text className="detail-price">{mode==='points'?(item.points?item.points+' 积分起':'暂不可兑换'):item.price!==null?(item.currency==='CNY'?'¥':item.currency+' ')+(item.price/100).toFixed(2)+' 起':'价格待定'}</Text>
            {mode!=='points'&&<ActionButton  className="cart-link" ariaLabel={'查看购物车，共'+cartCount+'件'} onClick={()=>Taro.navigateTo({url:'/pages/cart/index'})}><View className="cart-bag-icon"/><Text>{cartCount>99?'99+':cartCount}</Text></ActionButton>}
          </View>
          <View className="product-purchase-actions">
            {item.kind==='products'&&hasVariants&&<Picker range={variants.map((v:any)=>v.label||v.key)} value={variantIndex} onChange={(e)=>{
              const nextIndex=Number(e.detail.value);setVariantIndex(Number.isNaN(nextIndex)?0:nextIndex);}}>
              <ActionView hoverClass="detail-field-pressed" className="field-input">已选规格：{selectedVariant?.label || '默认规格'}</ActionView>
            </Picker>}
            {item.kind==='products'&&hasVariants&&<Picker range={['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20']} value={Math.max(0,Number(quantity)-1)} onChange={(e)=>setQuantity(normalizeQuantity(String(Math.max(1,Number(e.detail.value)+1))))}>
              <ActionView hoverClass="detail-field-pressed" className="field-input">数量：{quantity}</ActionView>
            </Picker>}
            {mode!=='points'&&<ActionButton  className="secondary" disabled={!item.kind||!variantKey} onClick={()=>Taro.navigateTo({url:'/pages/checkout/index?id='+item.id+'&mode=cart&variant='+encodeURIComponent(variantKey)+'&quantity='+encodeURIComponent(quantity)})}>加入购物车</ActionButton>}
            <ActionButton  disabled={!item.kind||!variantKey} onClick={()=>Taro.navigateTo({url:'/pages/checkout/index?id='+item.id+'&mode='+mode+'&variant='+encodeURIComponent(variantKey)+'&quantity='+encodeURIComponent(quantity)})}>{mode==='points'?'选择规格并兑换':'立即购买'}</ActionButton>
          </View>
        </View>}
        {(item.specs||[]).map((s:any)=><View className="spec" key={s.name}><Text>{s.name}</Text><Text>{s.values.join(' / ')}</Text></View>)}
        {item.kind==='products'&&<Text className="section-title">商品详情</Text>}
        <>{item.richNodes?.length?<RichBody nodes={item.richNodes} onFullscreen={setFullscreen}/>:<Text className="body" selectable>{item.body}</Text>}</>
        {(item.imageIds||[]).filter((id:string)=>id!==item.imageId).map((id:string)=><Image key={id} className="body-image" src={image(id)} mode="widthFix"/>)}
        <View className="content-interactions">
          <ActionButton  openType="share" onClick={()=>void interact('share')}>转发</ActionButton>
          <ActionButton  disabled={busy} className={actions.includes('like')?'selected':''} onClick={()=>void interact('like',!actions.includes('like'))}>{actions.includes('like')?'已点赞':'点赞'}</ActionButton>
          <ActionButton  disabled={busy} className={actions.includes('favorite')?'selected':''} onClick={()=>void interact('favorite',!actions.includes('favorite'))}>{actions.includes('favorite')?'已收藏':'收藏'}</ActionButton>
        </View>
      </View>
      <Floating entries={floating} path={'/'+item.kind+'/'+item.slug} hidden={fullscreen}/>
    </>}
    <GlobalNavigation active={active} floating={false} hidden={fullscreen}/>
  </View>;
}
