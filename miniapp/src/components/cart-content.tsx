import {ActionButton,ActionView,ActionImage,ActionInput} from './interaction';
import {useState,useEffect,useRef} from 'react';
import Taro,{useDidShow} from '@tarojs/taro';
import {View,Text,Button,Input,Image,Picker} from '@tarojs/components';
import {request,token,image,origin} from '../lib/api';
import {cartQuantity,cartLineKey,replaceLocalVariant} from '../lib/cart.mjs';
import {guestCart,saveGuestCart,mergeGuestCart,dropGuestLine} from '../lib/cart-storage';
export default function CartContent({onCheckout}:{onCheckout:(lines:any[])=>void}){
  const storageKey='mini-cart-selected:'+origin;
  const [rows,setRows]=useState<any[]>([]),[selected,setSelected]=useState<string[]>(()=>Taro.getStorageSync(storageKey+':guest')||[]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const loadingRef=useRef(false),busyRef=useRef(false),pendingCheckout=useRef(false),session=useRef(token()),selectionOwner=useRef(token()?'':'guest');
  useEffect(()=>{if(selectionOwner.current&&session.current===token())Taro.setStorageSync(storageKey+':'+selectionOwner.current,selected);},[selected,rows]);
  async function load(){
    if(loadingRef.current)return;
    loadingRef.current=true;setLoading(true);
    const current=token();
    try{
      if(session.current&&session.current!==current){setRows([]);setSelected([]);pendingCheckout.current=false;}
      session.current=current;
      const nextOwner=current?'user:'+String((await request('/api/mini/member/session')).user.id):'guest';
      if(token()!==current)return;
      let nextSelected=selected;
      if(selectionOwner.current!==nextOwner){
        nextSelected=selectionOwner.current==='guest'&&pendingCheckout.current?selected:(Taro.getStorageSync(storageKey+':'+nextOwner)||[]);
        selectionOwner.current=nextOwner;setSelected(nextSelected);
      }
      let source:any[];
      if(current){
        let failed:any[]=[];
        try{failed=await mergeGuestCart()||[];}catch(e){setError((e as Error).message);failed=guestCart().map(r=>({...r,guest:true,reason:'暂未合并，可重试或删除'}));}
        const r=await request('/api/mini/member/cart');source=[...r.rows,...failed];
      }else source=guestCart();
      const products=new Map<string,any>();
      await Promise.all([...new Set(source.map(r=>r.productId))].map(async id=>{
        try{products.set(id,(await request('/api/mini/catalog?kind=products&id='+encodeURIComponent(id))).item);}catch{products.set(id,null);}
      }));
      const priceKey=storageKey+':prices:'+nextOwner,oldPrices=Taro.getStorageSync(priceKey)||{};
      const fresh=source.map(r=>{
        const p=products.get(r.productId),choices=(p?.variants||[]).filter((v:any)=>v.priceMinor!=null),v=choices.find((v:any)=>v.key===r.variant);
        if(current)return {...r,choices,priceChanged:oldPrices[cartLineKey(r)]!=null&&oldPrices[cartLineKey(r)]!==r.priceMinor};
        return {...r,title:p?.title||r.title,imageId:p?.imageId||r.imageId,choices,currency:p?.currency||r.currency,priceMinor:v?.priceMinor??r.priceMinor,available:v?.available,reason:!p?'商品暂不可访问，请稍后重试':!v?'规格已失效':v.available!=null&&v.available<r.quantity?'库存不足':''};
      });
      if(token()!==current)return;
      Taro.setStorageSync(priceKey,Object.fromEntries(fresh.map(r=>[cartLineKey(r),r.priceMinor])));
      setRows(fresh);
      if(current&&pendingCheckout.current){
        pendingCheckout.current=false;
        const chosen=fresh.filter(r=>!r.reason&&nextSelected.includes(cartLineKey(r)));
        if(chosen.length)onCheckout(chosen.map(r=>({productId:r.productId,variant:r.variant,quantity:r.quantity,variantLabel:r.variantLabel})));
      }
    }finally{loadingRef.current=false;setLoading(false);if(token()!==current)void load().catch(e=>setError(e.message));}
  }
  useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
  useDidShow(()=>{void load().catch(e=>setError(e.message));});
  async function act(fn:()=>Promise<void>){if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{await fn();await load();}catch(e){setError((e as Error).message);}finally{busyRef.current=false;setBusy(false);}}
  const eligible=rows.filter(r=>!r.reason),chosen=eligible.filter(r=>selected.includes(cartLineKey(r)));
  const chosenQuantity=chosen.reduce((n,r)=>n+(r.quantity||0),0);
  const totals=Object.entries(chosen.reduce((a:any,r:any)=>({...a,[r.currency||'CNY']:(a[r.currency||'CNY']||0)+(r.priceMinor||0)*r.quantity}),{}));
  function setQuantity(r:any,value:string){return act(async()=>{const quantity=cartQuantity(value);if(token()&&!r.guest)await request('/api/mini/member/cart-set',{productId:r.productId,variant:r.variant,quantity});else saveGuestCart(guestCart().map(v=>cartLineKey(v)===cartLineKey(r)?{...v,quantity}:v));});}
  return <View style={{paddingBottom:'150px'}}>
    {!token()&&<Text className="intro">商品暂存在当前设备，结算时登录即可同步。</Text>}
    {error&&<View className="notice">{error}<ActionButton size="mini" onClick={()=>act(load)}>重试</ActionButton></View>}
    {!rows.length&&<View className="empty">{loading?'正在读取购物车…':'购物车还是空的，去挑选喜欢的商品吧。'}{!loading&&<ActionButton onClick={()=>Taro.reLaunch({url:'/pages/index/index?target=products'})}>去逛逛</ActionButton>}</View>}
    {rows.map(r=><View className="panel" key={(r.guest?'guest:':'')+cartLineKey(r)}>
      <View style={{display:'flex',gap:'12px',alignItems:'center'}}>
        <ActionView
          disabled={!!r.reason || busy}
          className={'cart-row-select' + (!!r.reason || busy ? ' disabled' : '')}
          onClick={() =>
            !busy &&
            !r.reason &&
            setSelected(
              selected.includes(cartLineKey(r))
                ? selected.filter((k) => k !== cartLineKey(r))
                : [...selected, cartLineKey(r)],
            )
          }
        >
          {selected.includes(cartLineKey(r)) ? '✓' : '○'}
        </ActionView>
        {r.imageId&&<ActionImage src={image(r.imageId)} style={{width:'64px',height:'64px',flexShrink:0,borderRadius:'8px'}} mode="aspectFill" onClick={()=>Taro.navigateTo({url:'/pages/detail/index?kind=products&id='+encodeURIComponent(r.productId)})}/>}
        <View><Text>{r.title}</Text><Text className="intro">{r.variantLabel||'默认规格'}</Text><Text>{r.currency==='CNY'?'¥':r.currency||'¥'} {((r.priceMinor||0)/100).toFixed(2)}</Text></View>
      </View>
      {(r.choices||[]).length>1&&!r.guest&&<Picker range={r.choices.map((v:any)=>v.label||v.key)} value={Math.max(0,r.choices.findIndex((v:any)=>v.key===r.variant))} onChange={e=>act(async()=>{
        const v=r.choices[Number(e.detail.value)];if(!v||v.key===r.variant)return;
        if(token())await request('/api/mini/member/cart-variant',{id:r.id,productId:r.productId,variant:v.key,quantity:r.quantity});
        else saveGuestCart(replaceLocalVariant(guestCart(),r,v));
        setSelected(selected.map(k=>k===cartLineKey(r)?r.productId+':'+v.key:k));
      })}><ActionView className="field-input">更换规格：{r.variantLabel||'默认规格'} ▾</ActionView></Picker>}
      {r.priceChanged&&<Text className="notice">商品价格已更新，请核对当前单价。</Text>}
      {r.reason&&<Text className="notice">{r.reason}{r.available!=null?' · 可售 '+r.available:''}</Text>}
      <View style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'12px'}}>
        <ActionButton size="mini" disabled={busy||!!r.guest||r.quantity<=1} onClick={()=>setQuantity(r,String(r.quantity-1))}>−</ActionButton>
        <ActionInput type="number" disabled={busy||!!r.guest} value={String(r.quantity)} style={{width:'44px',textAlign:'center'}} onBlur={e=>setQuantity(r,e.detail.value)}/>
        <ActionButton size="mini" disabled={busy||!!r.guest||r.quantity>=999} onClick={()=>setQuantity(r,String(r.quantity+1))}>＋</ActionButton>
        <ActionButton size="mini" disabled={busy} onClick={()=>act(async()=>{if(token()&&!r.guest)await request('/api/mini/member/cart-remove',{id:r.id});else dropGuestLine(r);setSelected(selected.filter(k=>k!==cartLineKey(r)));})}>删除</ActionButton>
      </View>
      <Text className="intro">小计：{((r.priceMinor||0)*r.quantity/100).toFixed(2)} {r.currency||'CNY'}</Text>
    </View>)}
    {!!rows.length&&<View className="panel cart-settlement"><ActionButton size="mini" disabled={busy||!eligible.length} onClick={()=>setSelected(eligible.every(r=>selected.includes(cartLineKey(r)))?[]:eligible.map(cartLineKey))}>{eligible.length>0&&eligible.every(r=>selected.includes(cartLineKey(r)))?'✓ 已全选':'全选可购商品'}</ActionButton>
      {totals.map(([currency,total])=><Text key={currency}>合计 {currency} {(Number(total)/100).toFixed(2)}（未含运费）</Text>)}
      <ActionButton disabled={busy||loading||!chosen.length} onClick={async()=>{if(!token()){pendingCheckout.current=true;await Taro.navigateTo({url:'/pages/login/index'});return;}onCheckout(chosen.map(r=>({productId:r.productId,variant:r.variant,quantity:r.quantity,variantLabel:r.variantLabel})));}}>去结算（{chosen.length}个规格，{chosenQuantity}件）</ActionButton>
    </View>}
  </View>;
}
