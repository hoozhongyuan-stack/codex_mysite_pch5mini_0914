import {ActionButton,ActionView,ActionInput} from '../../components/interaction';
import {behavior} from '../../lib/behavior';
import {checkoutOperation} from '../../lib/checkout-operation.mjs';
import {checkoutOwnerKey,submissionDefinitelyRejected} from '../../../../lib/checkout-recovery.mjs';
import GlobalNavigation from '../../components/global-navigation';
import CartContent from '../../components/cart-content';
import {cartQuantity,quoteStamp} from '../../lib/cart.mjs';
import {addGuestCart} from '../../lib/cart-storage';
import { useState, useRef, useEffect } from 'react';
import Taro, { useLoad, useDidShow, useDidHide } from '@tarojs/taro';
import { View, Text, Button, Picker, Input } from '@tarojs/components';
import { request, upload, privateImage, token, origin } from '../../lib/api';
const base = '/api/mini/member/';
const statuses: Record<string, string> = {
  pending_payment: '待付款',
  pending_review: '待审核',
  pending_ship: '待发货',
  pending_receive: '待收货',
  completed: '已完成',
  closed: '已关闭',
  aftersale: '售后中',
};
export default function Checkout() {
  const [params, setParams] = useState<any>({}),
    [item, setItem] = useState<any>(null),
    [order, setOrder] = useState<any>(null),
    [addresses, setAddresses] = useState<any[]>([]),
    [selected, setSelected] = useState(0),
    [variant, setVariant] = useState(0),
    [quantity, setQuantity] = useState('1'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState(''),
    [files, setFiles] = useState<string[]>([]),
    [method, setMethod] = useState(0),
    [payer, setPayer] = useState(''),
    [paidAt, setPaidAt] = useState(new Date().toISOString()),
    [payments, setPayments] = useState<any>({}),
    [cartLines,setCartLines]=useState<any[]|null>(null),
    [quote,setQuote]=useState<any>(null),
    [note,setNote]=useState('');
  const submitting=useRef(false),loadGeneration=useRef(0);
  const orderId=useRef('');
  const pendingSubmission=useRef<any>(null);
  const incomingVariantRef=useRef(''), incomingQuantityRef=useRef('1');
  const draftKey=useRef('mini-checkout-draft:'+origin+':guest');
  const verifiedSession=useRef(''), ownerId=useRef(''), routeParams=useRef<any>({});
  useDidHide(()=>{if(!order&&(!token()||verifiedSession.current===token()))Taro.setStorageSync(draftKey.current,{params,cartLines,variant,quantity,addressId:addresses[selected]?.id,note});});
  const restoreAddress=useRef('');
  function normalizeQuantity(value:string){
    try{return String(cartQuantity(value));}catch{return '1';}
  }
  function initializeFromRoute(p:any){
    incomingVariantRef.current = p.variant ? String(p.variant) : '';
    incomingQuantityRef.current = p.quantity ? normalizeQuantity(String(p.quantity)) : '1';
  }
  useLoad((p) => {
    if(!p.order&&(p.mode!=='cart'||p.selection==='1')&&p.mode!=='points')behavior('checkout_start');
    orderId.current=p.order||'';
    routeParams.current=p;
    initializeFromRoute(p);
    setParams(p);
    if(!p.order && p.id)
      void request(
        '/api/mini/catalog?kind=products&id=' + encodeURIComponent(p.id || ''),
      )
        .then((r) => setItem(r.item))
        .catch((e) => setError(e.message));
  });
  function restoreDraft(){
    pendingSubmission.current=Taro.getStorageSync(draftKey.current+':pending')||null;
    const draft=Taro.getStorageSync(draftKey.current),p=routeParams.current;
    if(!p.order&&draft&&draft.params?.id==p.id&&draft.params?.mode==p.mode){setCartLines(draft.cartLines);setVariant(draft.variant||0);setQuantity(draft.quantity||'1');setNote(draft.note||'');restoreAddress.current=draft.addressId||'';}
    if(p.selection==='1'){
      const selectionKey='mini-cart-checkout:'+origin+':'+token(),lines=Taro.getStorageSync(selectionKey);
      if(Array.isArray(lines)&&lines.length){setCartLines(lines);setQuote(null);setKey('');Taro.removeStorageSync(selectionKey);}
    }
  }
  async function verifyOwner(){
    const current=token();
    if(!current)throw Error('请先登录');
    const profile=await request(base+'session',undefined,current);
    if(token()!==current)throw Error('登录状态已变化，请重试');
    const next=String(profile.user.id),changed=!!ownerId.current&&ownerId.current!==next,restore=verifiedSession.current!==current||ownerId.current!==next;
    ownerId.current=next;verifiedSession.current=current;
    draftKey.current=checkoutOwnerKey(origin,next);if(restore)restoreDraft();
    if(changed){setCartLines(null);setOrder(null);setAddresses([]);setSelected(0);setNote('');setFiles([]);setPayer('');setQuote(null);setKey('');}
    return changed;
  }
  useDidShow(() => {
    const captured=token(),generation=++loadGeneration.current;
    const valid=()=>token()===captured&&loadGeneration.current===generation;
    if(!captured){pendingSubmission.current=null;setOrder(null);setAddresses([]);return;}
    if(verifiedSession.current!==captured){pendingSubmission.current=null;setOrder(null);setAddresses([]);setFiles([]);setPayer('');}
    void (async()=>{
      await verifyOwner();if(!valid())return;setError('');
      if(orderId.current){const next=await request(base+'order?id='+encodeURIComponent(orderId.current),undefined,captured);if(!valid())return;setOrder(next);}
      const r=await request(base+'addresses',undefined,captured);if(!valid())return;
      const desired=restoreAddress.current||addresses[selected]?.id;
      const found=r.rows.findIndex((a:any)=>a.id===desired),defaultIndex=r.rows.findIndex((a:any)=>a.isDefault===true);
      setAddresses(r.rows);setSelected(found>=0?found:defaultIndex>=0?defaultIndex:0);restoreAddress.current='';
      const nextPayments=await request(base+'payments',undefined,captured);if(valid())setPayments(nextPayments);
    })().catch(e=>{if(valid())setError(e.message);});
  });
  async function submitPending(pending:any,operation:any){
    try{const result=await operation.request(pending.path,pending.data);if(pending.path.endsWith('create-order'))behavior('order_submit');return result;}
    catch(e){
      if(submissionDefinitelyRejected((e as any).status)&&token()===operation.session){pendingSubmission.current=null;Taro.removeStorageSync(operation.ownerKey+':pending');}
      throw e;
    }
  }
  async function run(fn: (operation:any) => Promise<void>) {
    if (submitting.current) return;
    if(!token()){const r=await Taro.showModal({title:'登录后继续',content:'登录后可使用收货地址并提交订单',confirmText:'去登录',cancelText:'继续浏览'});if(r.confirm)await Taro.navigateTo({url:'/pages/login/index'});return;}
    const captured=token();
    submitting.current=true;
    setBusy(true);
    setError('');
    try {
      const changed=await verifyOwner();if(changed)throw Error('账号已切换，请重新核对收货地址后继续');
      const operation=checkoutOperation(captured,draftKey.current,token,request);operation.assertCurrent();
      await fn(operation);
    } catch (e) {
      if(token()===captured)setError((e as Error).message);
    } finally {
      submitting.current=false;
      setBusy(false);
    }
  }
  async function refresh(operation:any) {
    if (order) setOrder(await operation.request(base + 'order?id=' + order.id));
  }
  const variants = (item?.variants || []).filter((v: any) =>
      params.mode === 'points' ? v.pointsPrice > 0 : v.priceMinor !== null,
    ),
    v = variants[variant];
  useEffect(()=>{
    if(!item) return;
    const nextVariants=(item?.variants||[]).filter((x:any)=>params.mode==='points'?x.pointsPrice>0:x.priceMinor!==null);
    if(!nextVariants.length){
      setVariant(0);
    } else {
      const target=nextVariants.findIndex((x:any)=>x.key===incomingVariantRef.current);
      setVariant(target>=0?target:Math.max(0,Math.min(variant,nextVariants.length-1)));
    }
    setQuantity(normalizeQuantity(incomingQuantityRef.current));
    incomingVariantRef.current='';
    incomingQuantityRef.current='1';
  }, [item?.id, params.mode, item?.variants?.length]);
  useEffect(()=>{
    if(!token()||!payments.offline||(params.mode==='cart'&&item)||params.mode==='points'||order||pendingSubmission.current||(!cartLines&&!v))return;
    let active=true;
    try{
      const lines=cartLines||[{productId:item.id,variant:v.key,quantity:cartQuantity(quantity)}];
      void request(base+'quote',{items:lines}).then(next=>{if(active){setQuote(next);setError('');}}).catch(e=>{if(active){setQuote(null);setError(e.message);}});
    }catch(e){setQuote(null);setError((e as Error).message);}
    return()=>{active=false;};
  },[cartLines,item?.id,v?.key,quantity,payments.offline,params.mode,order?.id]);
  return (
    <View className="content has-nav">
      <Text className="page-title">
        {order
          ? '订单详情'
          : params.mode==='cart'&&item?'选择商品规格':params.mode === 'cart'&&!cartLines&&!item?'购物车':params.mode === 'points'
            ? '确认兑换'
            : '确认订单'}
      </Text>
      {params.mode==='cart'&&!item&&!cartLines&&!order&&<CartContent onCheckout={lines=>{behavior('checkout_start');setCartLines(lines);setQuote(null);}}/>}
      {!token()&&params.mode!=='cart'&&<View className="panel"><Text>可以先选择商品规格，登录后继续下单。</Text><ActionButton onClick={()=>Taro.navigateTo({url:'/pages/login/index'})}>登录后继续</ActionButton></View>}
      {error && <View className="notice">{error}</View>}
      {pendingSubmission.current&&<View className="notice"><Text>上次提交结果待确认，请先查询，避免重复下单。</Text><ActionButton disabled={busy} onClick={()=>run(async(operation)=>{const pending=pendingSubmission.current;if(!pending)return;const r=await submitPending(pending,operation);pendingSubmission.current=null;Taro.removeStorageSync(operation.ownerKey+':pending');Taro.removeStorageSync(operation.ownerKey);orderId.current=r.id;setOrder(r);setCartLines(null);setQuote(null);})}>查询上次提交结果</ActionButton></View>}
      {!order&&!(params.mode==='cart'&&item)&&<ActionButton
        size="mini"
        onClick={() => Taro.navigateTo({ url: '/pages/account/index?section=addresses' })}
      >
        新增 / 编辑收货地址
      </ActionButton>}
      {order ? (
        <>
          <View className="panel">
            <Text>{statuses[order.status] || order.status}</Text>
            <Text>{order.order_number || order.id}</Text>
            {(order.items||[]).map((line:any)=><Text key={line.id||line.product_id+line.variant}>{line.snapshot?.titleZh||line.titleZh||'商品'} × {line.quantity}</Text>)}
            <Text>运费：{order.currency==='PTS'?'0 积分':((order.shipping||0)/100).toFixed(2)+' '+order.currency}</Text>
            <Text className="detail-price">
              {order.total / (order.currency === 'PTS' ? 1 : 100)}{' '}
              {order.currency === 'PTS' ? '积分' : order.currency}
            </Text>
            <Text>
              {order.data.address.name} · {order.data.address.street}
            </Text>
          </View>
          {order.status === 'pending_payment' && order.currency !== 'PTS' && (
            <View className="panel">
              <Picker
                range={(order.data.methods || []).map((m: any) => m.nameZh)}
                value={method}
                onChange={(e) => setMethod(Number(e.detail.value))}
              >
                <ActionView className="field-input">
                  {order.data.methods?.[method]?.nameZh || '无可用收款方式'}
                </ActionView>
              </Picker>
              <Text>{order.data.methods?.[method]?.instructionsZh}</Text>
              {order.data.methods?.[method]?.imageId && (
                <ActionButton
                  onClick={() =>
                    run(() =>
                      privateImage(
                        base +
                          'payment-image?id=' +
                          order.id +
                          '&asset=' +
                          order.data.methods[method].imageId,
                      ),
                    )
                  }
                >
                  查看收款二维码
                </ActionButton>
              )}
              <ActionInput
                className="field-input"
                placeholder="付款人"
                value={payer}
                onInput={(e) => setPayer(e.detail.value)}
              />
              <Text className="field-label">付款时间（含时区）</Text>
              <ActionInput
                className="field-input"
                value={paidAt}
                onInput={(e) => setPaidAt(e.detail.value)}
              />
              <ActionButton
                disabled={busy || files.length >= 6}
                onClick={() =>
                  run(async (operation) => {
                    const r = await upload(
                      base + 'proof-upload?id=' + order.id,
                      { purpose: 'payment' },
                    );
                    operation.assertCurrent();setFiles([...files, r.id]);
                  })
                }
              >
                上传付款凭证（{files.length}/6）
              </ActionButton>
              <ActionButton
                disabled={busy || !files.length || !payer}
                onClick={() =>
                  run(async (operation) => {
                    await operation.request(base + 'proof', {
                      id: order.id,
                      files,
                      payer,
                      methodId: order.data.methods[method].id,
                      paidAt,
                    });
                    await refresh(operation);
                  })
                }
              >
                提交付款审核
              </ActionButton>
            </View>
          )}
          {order.status === 'pending_payment' && order.currency !== 'PTS' && (
            <ActionButton
              onClick={() =>
                run(async (operation) => {
                  await operation.request(base + 'cancel', { id: order.id });
                  await refresh(operation);
                })
              }
            >
              取消订单
            </ActionButton>
          )}
          {order.status === 'pending_receive' && (
            <ActionButton
              onClick={() =>
                run(async (operation) => {
                  const c = await Taro.showModal({
                    title: '确认收货',
                    content: '请确认已收到商品',
                  });
                  if (c.confirm) {
                    await operation.request(base + 'receive', { id: order.id });
                    await refresh(operation);
                  }
                })
              }
            >
              确认收货
            </ActionButton>
          )}
          {order.currency === 'PTS' && order.status === 'pending_ship' && (
            <ActionButton
              onClick={() =>
                run(async (operation) => {
                  const c = await Taro.showModal({
                    title: '取消兑换',
                    content: '确认取消兑换并退回积分？',
                  });
                  if (c.confirm) {
                    await operation.request(base + 'cancel-redemption', { id: order.id });
                    await refresh(operation);
                  }
                })
              }
            >
              取消兑换
            </ActionButton>
          )}
          <ActionButton onClick={() => run(refresh)}>刷新订单状态</ActionButton>
          <ActionButton onClick={()=>Taro.reLaunch({url:'/pages/index/index'})}>继续逛逛</ActionButton>
        </>
      ) : (
        (item||cartLines) && (
          <>
            <View className="panel">
              {cartLines&&<><Text>已选 {cartLines.length} 个规格</Text><ActionButton size="mini" onClick={()=>{setCartLines(null);setQuote(null);void Taro.redirectTo({url:'/pages/cart/index'});}}>返回购物车</ActionButton></>}
              {item&&<><Text>{item.title}</Text>
              <Picker
                range={variants.map(
                  (v: any) =>
                    (v.label||v.key) +
                    ' · ' +
                    (params.mode === 'points'
                      ? v.pointsPrice + '积分'
                      : v.priceMinor / 100 + ' ' + item.currency),
                )}
                value={variant}
                onChange={(e) => {
                  setVariant(Number(e.detail.value));
                  setKey('');setQuote(null);
                }}
              >
                <ActionView className="field-input">
                  {v ? (v.label||v.key) : '暂无可选规格'}{v&&<Text className="intro">{v.available==null?'库存将在提交时核验':'当前可售 '+v.available+' 件'}</Text>}
                </ActionView>
              </Picker>
              <ActionInput
                className="field-input"
                type="number"
                value={quantity}
                onInput={(e) => {
                  setQuantity(e.detail.value);
                  setKey('');setQuote(null);
                }}
              />
              </>}
              {!(params.mode==='cart'&&item)&&<Picker
                range={addresses.map((a) => a.name + ' · ' + a.street)}
                value={selected}
                onChange={(e) => {
                  setSelected(Number(e.detail.value));
                  setKey('');setQuote(null);
                }}
              >
                <ActionView className="field-input">
                  {addresses[selected] ? addresses[selected].name+' · '+addresses[selected].phone+' · '+addresses[selected].street : '请先添加收货地址'}
                </ActionView>
              </Picker>}
              <Text className="price">
                {v
                  ? params.mode === 'points'
                    ? v.pointsPrice * Number(quantity) + ' 积分'
                    : (v.priceMinor * Number(quantity)) / 100 +
                      ' ' +
                      item?.currency
                  : ''}
              </Text>
              {params.mode==='cart'&&item&&<ActionButton onClick={async()=>{try{const n=cartQuantity(quantity);if(!v)throw Error('请选择规格');const line={productId:item.id,variant:v.key,variantLabel:v.label||'默认规格',quantity:n,title:item.title,imageId:item.imageId,currency:item.currency,priceMinor:v.priceMinor};if(token())await request(base+'cart-add',line);else addGuestCart(line);behavior('cart_add',item.id);await Taro.showToast({title:'已加入购物车'});await Taro.redirectTo({url:'/pages/cart/index'});}catch(e){setError((e as Error).message);}}}>加入购物车</ActionButton>}
              {!(params.mode==='cart'&&item)&&<><ActionInput className="field-input" placeholder="订单备注（选填）" maxlength={1000} value={note} onInput={e=>{setNote(e.detail.value);setKey('');}}/>
              {quote&&<View className="panel">{quote.items.map((line:any)=><Text key={line.productId+line.variant}>{line.titleZh} · {cartLines?.find((r:any)=>r.productId===line.productId&&r.variant===line.variant)?.variantLabel||variants.find((r:any)=>r.key===line.variant)?.label||'已选规格'} × {line.quantity} · {(line.unitPrice/100).toFixed(2)}</Text>)}<Text>商品金额：{(quote.subtotal/100).toFixed(2)} {quote.currency}</Text><Text>运费：{(quote.shipping/100).toFixed(2)} {quote.currency}</Text><Text className="detail-price">合计：{(quote.total/100).toFixed(2)} {quote.currency}</Text><Text>支付方式：线下支付</Text></View>}
              {params.mode !== 'points' && !payments.offline && (
                <Text>现金交易暂未开放</Text>
              )}
              <ActionButton
                disabled={
                  busy || (!pendingSubmission.current&&(
                  (!v&&!cartLines) ||
                  !addresses[selected] ||
                  (params.mode !== 'points' && !payments.offline)))
                }
                loading={busy}
                onClick={() =>
                  run(async (operation) => {
                    if(pendingSubmission.current){const pending=pendingSubmission.current;const retry=await submitPending(pending,operation);pendingSubmission.current=null;Taro.removeStorageSync(operation.ownerKey+':pending');Taro.removeStorageSync(operation.ownerKey);orderId.current=retry.id;setOrder(retry);setCartLines(null);setQuote(null);return;}
                    const lines=cartLines||[{productId:item.id,variant:v.key,quantity:cartQuantity(quantity)}];
                    let fresh:any=null;
                    if(params.mode!=='points'){fresh=await operation.request(base+'quote',{items:lines});if(!quote||quoteStamp(quote)!==quoteStamp(fresh)){setQuote(fresh);setKey('');setError(quote?'金额发生变化，请核对最新金额后再次提交':'请核对商品金额、运费及合计，再次点击提交订单');return;}}
                    const c = await Taro.showModal({
                      title:
                        params.mode === 'points'
                          ? '确认扣除积分'
                          : '确认创建订单',
                      content: '请确认商品规格、数量和收货地址。',
                    });
                    operation.assertCurrent();
                    if (!c.confirm) return;
                    const requestKey =
                      key ||
                      'mini-' +
                        Date.now() +
                        '-' +
                        Math.random().toString(36).slice(2);
                    setKey(requestKey);
                    const data = {
                      requestKey,
                      address: addresses[selected],
                      variant: v?.key,
                      quantity: cartQuantity(quantity),
                      productId: item?.id,
                    };
                    const pending = {path:
                      base +
                        (params.mode === 'points' ? 'redeem' : 'create-order'),data:
                      params.mode === 'points'
                        ? data
                        : {
                            requestKey,
                            address: data.address,
                            items: lines,
                            expectedQuote:quoteStamp(fresh),note,fromCart:!!cartLines,
                          },
                    };
                    pendingSubmission.current=pending;Taro.setStorageSync(operation.ownerKey+':pending',pending);
                    const r=await submitPending(pending,operation);
                    pendingSubmission.current=null;Taro.removeStorageSync(operation.ownerKey+':pending');
                    Taro.removeStorageSync(operation.ownerKey);orderId.current=r.id;setOrder(r);setCartLines(null);setQuote(null);
                  })
                }
              >
                {pendingSubmission.current?'查询上次提交结果':params.mode === 'points' ? '确认兑换' : quote?'提交订单 · 线下支付':'核对订单金额'}
              </ActionButton></>}
            </View>
          </>
        )
      )}
      <GlobalNavigation active={params.mode==='cart'?'cart':'products'}/>
    </View>
  );
}
