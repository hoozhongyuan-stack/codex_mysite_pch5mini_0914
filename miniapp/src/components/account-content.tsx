import {ActionText,ActionButton,ActionView,ActionInput} from './interaction';
import { useState, useEffect, useRef } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Input, Button, Switch, Checkbox, CheckboxGroup } from '@tarojs/components';
import { request, saveSession, clearSession, token } from '../lib/api';
import {loginResult} from '../lib/response.mjs';
import MemberOverview from './member-overview';
import {orderLabel,amountLabel} from '../lib/member.mjs';
const base = '/api/mini/member/';
export default function Account({initialScreen='overview',embedded=false,onShop,initialFilter=''}: {initialScreen?:string;embedded?:boolean;onShop?:()=>void;initialFilter?:string}) {
  const [screen,setScreen]=useState(initialScreen),
    [orderFilter,setOrderFilter]=useState(initialFilter),
    [user, setUser] = useState<any>(null),
    [status, setStatus] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [agree, setAgree] = useState(false),
    [tab, setTab] = useState(initialScreen==='overview'||initialScreen==='login'?'orders':initialScreen),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [rows, setRows] = useState<any[]>([]),
    [points, setPoints] = useState<any>(null),
    [editing, setEditing] = useState<any>(null);
  const returnAfterLogin=useRef(initialScreen==='login');
  const intended=useRef(initialScreen==='login'?'overview':initialScreen);
  const agreed = useRef(false);
  const loadingSession=useRef(0);
  async function load() {
    const seq=++loadingSession.current, session=token();
    try {
      const config=await request(base+'status');
      if(seq!==loadingSession.current || token()!==session)return;
      setStatus(config);
      if(!session){setUser(null);setPoints(null);return;}
      const profile=await request(base+'session');
      const balance=await request(base+'points');
      if(seq!==loadingSession.current || token()!==session)return;
      setUser(profile.user);setPoints(balance);
    } catch(e){if(seq===loadingSession.current){setError((e as Error).message);if(!token()){setUser(null);setPoints(null);}}}
  }
  useDidShow(()=>{void load();});
  useEffect(()=>{void load();return ()=>{loadingSession.current++}},[]);
  function failure(e:unknown){
    setError((e as Error).message);
    if(!token() && user){setUser(null);setPoints(null);setRows([]);setEditing(null);intended.current=screen;setScreen('login');}
  }
  const sequence=useRef(0);
  async function content() {
    if (!user || !['orders','points','addresses','favorites','activities','history'].includes(tab)) return;
    const seq=++sequence.current;
    setRows([]);setTotal(0);
    try {
      const r = await request(base + tab + '?page=' + page + '&status=' + encodeURIComponent(orderFilter));
      if(seq!==sequence.current)return;
      setRows(r.rows || []);
      setTotal(r.total || 0);
      if (tab === 'points') setPoints(r);
    } catch (e) {
      if(seq===sequence.current)failure(e);
    }
  }
  useEffect(() => {
    void content();
    return ()=>{sequence.current++};
  }, [tab, user, page, orderFilter]);
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function login(wechat: boolean, bind = false) {
    await run(async () => {
      if (!agreed.current) throw Error('请勾选下方协议后登录');
      let result;
      if (wechat) {
        const { code } = await Taro.login();
        result = await request(base + (bind ? 'bind' : 'login'), {
          code,
          ...Object.fromEntries(
            (status?.policies || []).map((p: any) => [p.kind, p.version]),
          ),
        });
      } else result = await request(base + 'email-login', { email, password });
      result = loginResult(result);
      loadingSession.current++;setPoints(null);setRows([]);
      saveSession(result.session);
      setPassword('');
      setUser(result.user);
      if(returnAfterLogin.current){if(Taro.getCurrentPages().length>1)await Taro.navigateBack();else await Taro.redirectTo({url:'/pages/index/index'});return;}
      setScreen(intended.current);
      void load();
    });
  }
  const consent = (
      <View className="consent">
        <CheckboxGroup onChange={e=>{const checked=e.detail.value.includes('agree');agreed.current=checked;setAgree(checked);setError('');}}><Checkbox value="agree" checked={agree} color="#2e503c">已阅读并同意</Checkbox></CheckboxGroup>
        {['terms','privacy'].map((kind) => { const p = status?.policies?.find((v:any)=>v.kind===kind); return (
          <ActionText
            className="policy-link"
            key={kind}
            onClick={() => { if(!p){void load();void Taro.showToast({title:'协议加载中，请稍后重试',icon:'none'});return;}
              void Taro.showModal({
                title: p.kind === 'terms' ? '用户注册协议' : '隐私政策',
                content:
                  p.content.bodyZh ||
                  p.content.titleZh ||
                  '请联系管理员完善协议',
                showCancel: false,
              });}}
          >
            {kind === 'terms' ? '《用户注册协议》' : '《隐私政策》'}
          </ActionText>
        );})}
      </View>
);
  const open=(next:string,filter='')=>{if(embedded){void Taro.navigateTo({url:'/pages/account/index?section='+next+'&status='+filter});return;}setError('');setEditing(null);setRows([]);setTotal(0);setOrderFilter(filter);setPage(1);setTab(next);if(!user){intended.current=next;setScreen('login')}else setScreen(next)};
  if(screen==='overview')return <View className="content">{!embedded&&<Text className='page-title'>个人中心</Text>}{error&&<View className="notice">{error}</View>}<MemberOverview user={user} points={points} onOpen={open} onLogin={()=>{void Taro.navigateTo({url:'/pages/login/index'})}} onShop={onShop||(()=>Taro.redirectTo({url:'/pages/index/index?target=points'}))}/></View>;
  return (
    <View className="content"><ActionText className="member-back" onClick={()=>{if(Taro.getCurrentPages().length>1){void Taro.navigateBack()}else void Taro.redirectTo({url:'/pages/index/index?target=account'})}}>‹ {screen==='login'?'继续浏览':'个人中心'}</ActionText>
      <Text className="page-title">{!user?'登录账号':({orders:'我的订单',points:'我的积分',addresses:'我的地址',settings:'账户设置',favorites:'我的收藏',activities:'我的活动',history:'最近观看'} as any)[screen]||'个人中心'}</Text>
      {error && <View className="notice">{error}</View>}
      {!user ? (
        <View className="panel login-panel">
          <Text className="login-intro">登录后查看订单、积分和收货地址</Text>
          <Text className="login-label">邮箱</Text>
          <ActionInput
            className="field-input"
            value={email}
            placeholder="已有账号邮箱"
            onInput={(e) => setEmail(e.detail.value)}
          />
          <Text className="login-label">密码</Text>
          <ActionInput
            className="field-input"
            password
            value={password}
            placeholder="密码"
            onInput={(e) => setPassword(e.detail.value)}
          />
          {consent}
          <ActionButton loading={busy} disabled={busy} onClick={() => login(false)}>
            登录
          </ActionButton>
          <Text className="intro">
            已有网站账号请先登录，再绑定微信，以共用订单及积分。
          </Text>
          {status?.enabled && (
            <ActionButton disabled={busy} onClick={() => login(true)}>
              微信登录 / 注册
            </ActionButton>
          )}
        </View>
      ) : (
        <>

          {screen!=='settings'&&<View className="tabs">
            {[
              ['orders', '我的订单'],
              ['points', '我的积分'],
              ['addresses', '我的地址'],
            ].map(([k, l]) => (
              <ActionText
                className={tab === k ? 'selected' : ''}
                key={k}
                onClick={() => {
                  setEditing(null);setRows([]);setTab(k);setScreen(k);setOrderFilter('');
                  setPage(1);
                }}
              >
                {l}
              </ActionText>
            ))}
          </View>}
          {tab === 'points' && (
            <View className="panel">
              <Text>可用积分</Text>
              <Text className="detail-price">{points?.balance ?? '—'}</Text>
            </View>
          )}
          {screen!=='settings'&&rows.map((r) => (
            <ActionView
              className="panel"
              key={r.id || r.target || r.episode?.id}
              onClick={() => {
                if (tab === 'orders')
                  Taro.navigateTo({
                    url: '/pages/checkout/index?order=' + r.id,
                  });
              }}
            >
              {tab === 'addresses' ? (
                <>
                  <Text>
                    {r.name} · {r.phone}
                  </Text>
                  <Text className="intro">
                    {r.country} {r.province} {r.city} {r.district} {r.street}
                  </Text>
                  <ActionButton size="mini" onClick={() => setEditing(r)}>
                    编辑
                  </ActionButton>
                  <ActionButton
                    size="mini"
                    onClick={() =>
                      run(async () => {
                        const c = await Taro.showModal({
                          title: '删除地址',
                          content: '确认删除这个收货地址？',
                        });
                        if (c.confirm) {
                          await request(base + 'address-delete', { id: r.id });
                          await content();
                        }
                      })
                    }
                  >
                    删除
                  </ActionButton>
                </>
              ) : ['favorites','activities','history'].includes(tab) ? (
                <><Text className="order-heading">{r.title || r.event?.titleZh || r.episode?.titleZh || '内容记录'}</Text><Text className="intro">{tab==='activities' ? (r.status==='cancelled'?'已取消':r.checkedAt?'已签到':'已报名') : tab==='history' ? (r.completed?'已看完':`已观看 ${Math.floor((r.position||0)/60)} 分钟`) : ({product:'商品',article:'文章',salon:'沙龙会',video:'视频'} as any)[r.kind]}</Text>{tab==='favorites'&&['product','article'].includes(r.kind)&&<ActionButton size="mini" onClick={()=>Taro.navigateTo({url:'/pages/detail/index?kind='+(r.kind==='product'?'products':'articles')+'&id='+encodeURIComponent(r.target)})}>查看详情</ActionButton>}</>
              ) : tab === 'orders' ? (
                <>
                  <Text className="order-heading">{orderLabel(r.status)}</Text>{r.items?.map((i:any,k:number)=><View className="mini-order-item" key={k}><Text>{i.title || '商品'}</Text><Text>× {i.quantity}</Text></View>)}<Text className="order-meta">{r.order_number || r.id}</Text>
                  <Text className="intro">
                    {amountLabel(r.total,r.currency)}
                  </Text>
                </>
              ) : (
                <>
                  <Text>{r.reason || r.source}</Text>
                  <Text className="price">
                    {r.amount > 0 ? '+' : ''}
                    {r.amount}
                  </Text>
                  <Text className="intro">{r.created}</Text>
                </>
              )}
            </ActionView>
          ))}
          {screen!=='settings'&&!rows.length && <View className="empty">暂无记录</View>}
          {screen !== 'settings' && tab !== 'addresses' && total > (tab==='history'?12:20) && (
            <View className="pagination">
              <ActionButton
                size="mini"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </ActionButton>
              <Text>
                {page} / {Math.ceil(total / (tab==='history'?12:20))}
              </Text>
              <ActionButton
                size="mini"
                disabled={page * (tab==='history'?12:20) >= total}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </ActionButton>
            </View>
          )}
          {tab === 'addresses' && (
            <ActionButton
              onClick={() =>
                setEditing({
                  country: 'CN',
                  name: '',
                  phone: '',
                  city: '',
                  street: '',
                })
              }
            >
              新增地址
            </ActionButton>
          )}
          {screen==='addresses'&&editing && (
            <View className="panel">
              {[
                ['name', '收货人'],
                ['phone', '电话'],
                ['country', '国家代码，如 CN'],
                ['province', '省份'],
                ['city', '城市'],
                ['district', '区县'],
                ['street', '详细地址'],
                ['postalCode', '邮编'],
              ].map(([k, l]) => (
                <ActionInput
                  className="field-input"
                  key={k}
                  placeholder={l}
                  value={editing[k] || ''}
                  onInput={(e) =>
                    setEditing({ ...editing, [k]: e.detail.value })
                  }
                />
              ))}
              <View>
                <Switch
                  checked={editing.isDefault === true}
                  onChange={(e) =>
                    setEditing({ ...editing, isDefault: e.detail.value })
                  }
                />
                默认地址
              </View>
              <ActionButton
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await request(base + 'address-save', editing);
                    setEditing(null);
                    await content();
                  })
                }
              >
                保存地址
              </ActionButton>
              <ActionButton onClick={() => setEditing(null)}>取消</ActionButton>
            </View>
          )}
          {screen==='settings'&&status?.enabled && consent}
          {screen==='settings'&&status?.enabled && (
            <ActionButton disabled={busy} onClick={() => login(true, true)}>
              绑定当前微信
            </ActionButton>
          )}
          {screen==='settings'&&<ActionButton
            onClick={() =>
              run(async () => {
                await request(base + 'logout', {});
                loadingSession.current++;sequence.current++;clearSession();
                setUser(null);
                setRows([]);setPoints(null);setEditing(null);setTotal(0);setScreen('overview');setAgree(false);agreed.current=false;if(!embedded){if(Taro.getCurrentPages().length>1)await Taro.navigateBack();else await Taro.redirectTo({url:'/pages/index/index?target=account'});}
              })
            }
          >
            退出登录
          </ActionButton>}
        </>
      )}

    </View>
  );
}
