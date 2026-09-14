'use client';
import SiteLink from '../components/site-link';

import {behavior} from './behavior-client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useEffect, useState, useRef } from 'react';
import {
  ordersApi,
  money,
  stateEn,
  OrderFileUpload,
  OrderItems,
  OrderSummary,
  OrderNumber,
  ProductImage,
  historyLabels,
} from './order-shared';
import { orderErrorText } from '@/lib/shop-navigation.mjs';
import { orderStatuses } from '@/lib/order-domain.mjs';
import {SavedAddressPicker} from './address-book';
import VisitorMenu from './visitor-menu';
import { countryCodes } from '@/lib/order-countries.mjs';
const emptyAddress = { name: '', phone: '', country: '', city: '', street: '' };
export default function ShopClient({ lang, kind, id = '', embedded = false }: any) {
  const [confirmReceive,setConfirmReceive]=useState(false),[addressRevision,setAddressRevision]=useState(0);
  const attempt = useRef({ fingerprint: '', key: '' });
  const checkoutSeen=useRef(false);
  const checkoutErrorRef = useRef<HTMLParagraphElement | null>(null);
  const en = lang === 'en',
    t = (zh: string, english: string) => (en ? english : zh);
  const [rows, setRows] = useState<any[]>([]),
    [order, setOrder] = useState<any>(null),
    [addresses, setAddresses] = useState<any[]>([]),
    [address, setAddress] = useState<any>(emptyAddress),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState(''),
    [loadError, setLoadError] = useState(false),
    [needsLogin, setNeedsLogin] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [status, setStatus] = useState(''), [orderType,setOrderType]=useState(''),
    [note, setNote] = useState(''),
    [config, setConfig] = useState<any>(null),
    [files, setFiles] = useState<string[]>([]),
    [proof, setProof] = useState<any>({ payer: '', paidAt: '', methodId: '' }),
    [reason, setReason] = useState(''),
    [description, setDescription] = useState(''),
    [aftersale, setAftersale] = useState(false);
  const reload = async () => {
    if (id) {
      setOrder(await ordersApi('detail', { id }));
      return;
    }
    if (kind === 'cart') {
      const [cart, addr, c] = await Promise.all([
        ordersApi('cart'),
        ordersApi('addresses'),
        ordersApi('settings'),
      ]);
      if(cart.rows.length&&!checkoutSeen.current){checkoutSeen.current=true;behavior('checkout_start');}
      setRows(cart.rows);
      setAddresses(addr.rows);
      setConfig(c);
      const desired = new URLSearchParams(location.search);
      setSelected((prev) =>
        prev.length
          ? prev.filter((x) => cart.rows.some((r: any) => r.id === x))
          : cart.rows
              .filter(
                (r: any) =>
                  !desired.get('product') ||
                  (r.productId === desired.get('product') &&
                    r.variant === desired.get('variant')),
              )
              .map((r: any) => r.id),
      );
    } else {
      const result = await ordersApi('list', { page, status, orderType });
      setRows(result.rows);
      setPages(result.pages);
    }
  };
  useEffect(() => {
    setLoading(true);
    setError('');
    setLoadError(false);
    setNeedsLogin(false);
    reload()
      .catch((e) => {
        setError(orderErrorText(e, en));
        setLoadError(true);
        setNeedsLogin(e.status === 401);
      })
      .finally(() => setLoading(false));
  }, [id, kind, page, status, orderType]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(orderErrorText(e, en));
      requestAnimationFrame(() =>
        checkoutErrorRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        }),
      );
    } finally {
      setBusy(false);
    }
  };
  const action = async (name: string, input: any = {}) => {
    await ordersApi(name, { id, ...input }, true);
    await reload();
    setFiles([]);
    setAftersale(false);
  };
  const selectedRows = rows.filter((r) => selected.includes(r.id)),
    currency = selectedRows[0]?.currency || 'CNY',
    selectedQuantity = selectedRows.reduce((n, r) => n + (r.quantity || 0), 0),
    addressComplete = Boolean(
      address.name && address.phone && address.country && address.city && address.street,
    ),
    subtotal = selectedRows.reduce(
      (sum, r) => sum + (r.variantData?.priceMinor || 0) * r.quantity,
      0,
    ),
    shipping = config?.shipping?.[currency] || 0;
  return (
    <section
      className={embedded ? "member-business shop-page" : "public-section shop-page"}
      style={embedded ? {} : { maxWidth: 1120, margin: 'auto', padding: '40px 24px' }}
    >
      {!embedded && <nav
        className="shop-nav"
        aria-label={t('购物导航', 'Shopping navigation')}
      >
        <SiteLink href={`/${lang}/cart`}>{t('购物车', 'Cart')}</SiteLink>
        <SiteLink href={`/${lang}/orders`}>{t('我的订单', 'My orders')}</SiteLink>
        <SiteLink href={`/${lang}/products`}>{t('继续选购', 'Browse products')}</SiteLink>
        <VisitorMenu lang={lang} />
      </nav>}
      <h1>
        {id
          ? t('订单详情', 'Order details')
          : kind === 'cart'
            ? t('购物车', 'Cart')
            : t('我的订单', 'My orders')}
      </h1>
      {error && !needsLogin && (
        <p className="error" role="alert" ref={checkoutErrorRef}>
          {error}
        </p>
      )}
      {loading ? (
        <p>{t('正在加载…', 'Loading…')}</p>
      ) : loadError ? (
        <section className="shop-empty">
          <h2>
            {needsLogin
              ? t(
                  '登录后查看你的购物记录',
                  'Sign in to see your shopping activity',
                )
              : t('暂时无法加载', 'Unable to load this page')}
          </h2>
          <p>
            {needsLogin
              ? t(
                  '购物车和订单会保存在你的账号中。',
                  'Your cart and orders are saved to your account.',
                )
              : t('请检查连接后重试。', 'Check your connection and try again.')}
          </p>
          {needsLogin ? (
            <SiteLink
              className="btn primary"
              href={`/${lang}/account?returnTo=${encodeURIComponent('/' + lang + '/' + kind + (id ? '/' + id : ''))}`}
            >
              {t('登录 / 注册', 'Sign in / Register')}
            </SiteLink>
          ) : (
            <button className="btn" onClick={() => location.reload()}>
              {t('重试', 'Try again')}
            </button>
          )}
        </section>
      ) : id && order ? (
        <>
          <div className="order-status-heading">
            <b>
              {en
                ? stateEn[order.status]
                : (orderStatuses as any)[order.status]}
            </b>
            {order.sandbox === 1 && (
              <span role="status" className="notice">
                {t('沙箱测试订单', 'Sandbox order')}
              </span>
            )}
          </div>
          <div className="order-layout">
            <div className="order-main">
              <OrderItems order={order} en={en} />
              <section className="panel" style={{ padding: 24, marginTop: 20 }}>
                <h3>{t('收货信息', 'Shipping address')}</h3>
                <p>{['name','phone','country','province','city','district','street','postalCode'].map(k=>order.data.address[k]).filter(Boolean).join(' · ')}</p>
                <p>{order.data.note}</p>
              </section>
              {order.currency === 'PTS' && <section className="panel" style={{padding:24,marginTop:20}}><h3>{t('积分兑换订单','Points redemption')}</h3><p>{t('兑换积分','Points used')}：{order.total} · {t('包邮','Free shipping')}</p>{order.data.redemptionState === 'pending' && <p>{t('积分结算处理中，请勿重复下单。','Points settlement is pending. Please do not place a duplicate order.')}</p>}{order.status === 'pending_ship' && <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/mall/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:order.id})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setOrder(d);}catch(e:any){setError(e.message);}finally{setBusy(false);}}}>{t('取消兑换并退回积分','Cancel and return points')}</button>}</section>}
              {order.status === 'pending_payment' && order.currency !== 'PTS' && (
                <section
                  className="panel"
                  style={{ padding: 24, marginTop: 20 }}
                >
                  <h2>{t('线下付款', 'Offline payment')}</h2>
                  <p>
                    {t('付款截止', 'Payment deadline')}:{' '}
                    {new Date(order.expires_at).toLocaleString()}
                  </p>
                  {order.data.rejection && (
                    <p role="status" className="notice">{order.data.rejection}</p>
                  )}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const paidAt = String(new FormData(e.currentTarget).get('paidAt') || '');
                      run(() =>
                        action('proof', {
                          ...proof,
                          paidAt: paidAt
                            ? new Date(paidAt).toISOString()
                            : '',
                          files,
                          note,
                        }),
                      );
                    }}
                  >
                    {order.data.methods.map((m: any) => (
                      <label
                        className="panel"
                        key={m.id}
                        style={{
                          display: 'block',
                          padding: 20,
                          marginBottom: 12,
                        }}
                      >
                        <input
                          type="radio"
                          name="method"
                          required
                          checked={proof.methodId === m.id}
                          onChange={() =>
                            setProof({ ...proof, methodId: m.id })
                          }
                        />
                        <b>{en ? m.nameEn : m.nameZh}</b>
                        <p style={{ whiteSpace: 'pre-wrap' }}>
                          {en ? m.instructionsEn : m.instructionsZh}
                        </p>
                        {m.imageId && (
                          <img
                            src={
                              '/api/order-payment-image/' +
                              order.id +
                              '/' +
                              m.imageId
                            }
                            alt={t('收款码', 'Payment code')}
                            style={{ maxWidth: 240 }}
                          />
                        )}
                      </label>
                    ))}
                    <div className="field-grid">
                      <label className="field">
                        <span>
                          <b className="required-mark">*</b>
                          {t('付款人', 'Payer')}
                        </span>
                        <input
                          required
                          value={proof.payer}
                          onChange={(e) =>
                            setProof({ ...proof, payer: e.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>
                          <b className="required-mark">*</b>
                          {t('付款时间', 'Payment time')}
                        </span>
                        <input
                          required
                          type="datetime-local"
                          name="paidAt"
                          value={proof.paidAt}
                          onChange={(e) =>
                            setProof({ ...proof, paidAt: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label className="field">
                      {t('付款备注（选填）', 'Payment note (optional)')}
                      <textarea
                        maxLength={1000}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </label>
                    <OrderFileUpload
                      orderId={id}
                      files={files}
                      onChange={setFiles}
                      en={en}
                    />
                    <div className="order-actions">
                      <button aria-busy={Boolean(busy)}
                        className="btn primary"
                        disabled={busy || !files.length}
                      >
                        {t('提交付款凭证', 'Submit payment proof')}
                      </button>
                      <button aria-busy={Boolean(busy)}
                        type="button"
                        className="btn"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(t('确认取消此订单？', 'Cancel this order?'))
                          )
                            run(() => action('cancel'));
                        }}
                      >
                        {t('取消订单', 'Cancel order')}
                      </button>
                    </div>
                  </form>
                </section>
              )}
              {order.status === 'pending_review' && (
                <p role="status" className="notice">
                  {t(
                    '付款凭证待后台核实到账，请勿重复付款。',
                    'Payment proof is under review. Please do not pay again.',
                  )}
                </p>
              )}
              {order.data.logistics && (
                <section
                  className="panel"
                  style={{ padding: 24, marginTop: 20 }}
                >
                  <h3>{t('发货信息', 'Shipment')}</h3>
                  <p>
                    {order.data.logistics.company || '—'} ·{' '}
                    {order.data.logistics.number || '—'}
                  </p>
                  <p>{order.data.logistics.note}</p>
                  <p>{order.data.logistics.shippedAt}</p>
                </section>
              )}
              {order.status === 'pending_receive' && (
                <><Dialog open={confirmReceive} onOpenChange={setConfirmReceive}><DialogContent><DialogTitle>{t('确认签收','Confirm receipt')}</DialogTitle><DialogDescription>{t('确认已收到商品？','Have you received the items?')}</DialogDescription><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy} onClick={()=>run(async()=>{await action('receive');setConfirmReceive(false);})}>{t('已收到，确认签收','Received, confirm')}</button></DialogContent></Dialog>
                <button aria-busy={Boolean(busy)}
                  className="btn primary"
                  disabled={busy}
                  onClick={() => setConfirmReceive(true)}
                >
                  {t('确认签收', 'Confirm receipt')}
                </button></>
              )}
              {['pending_ship', 'pending_receive', 'completed'].includes(
                order.status,
              ) && (
                <button
                  className="btn"
                  onClick={() => {
                    setAftersale(!aftersale);
                    setFiles([]);
                  }}
                >
                  {t('申请整单售后', 'Request after-sales')}
                </button>
              )}
              {aftersale && (
                <form
                  className="panel"
                  style={{ padding: 24 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() =>
                      action('aftersale', { reason, description, files }),
                    );
                  }}
                >
                  <label className="field">
                    <span>
                      <b className="required-mark">*</b>
                      {t('售后原因', 'Reason')}
                    </span>
                    <textarea
                      required
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    {t('补充说明（选填）', 'Additional details (optional)')}
                    <textarea
                      maxLength={2000}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>
                  <OrderFileUpload
                    orderId={id}
                    purpose="aftersale"
                    files={files}
                    onChange={setFiles}
                    en={en}
                  />
                  <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
                    {t('提交申请', 'Submit request')}
                  </button>
                </form>
              )}
              {order.status === 'aftersale' && (
                <div role="status" className="notice">
                  <p>
                    {t(
                      '售后处理中，暂不可签收。',
                      'After-sales in progress. Receipt confirmation is paused.',
                    )}
                  </p>
                  <p>{order.data.aftersale.reason}</p>
                  <button aria-busy={Boolean(busy)}
                    className="btn"
                    disabled={busy}
                    onClick={() => run(() => action('withdraw'))}
                  >
                    {t('撤销申请', 'Withdraw request')}
                  </button>
                </div>
              )}
              {order.status === 'closed' && <p>{order.data.closeReason}</p>}
              <h3>{t('订单记录', 'Order history')}</h3>
              {order.history.map((h: any) => (
                <p key={h.id}>
                  {new Date(h.created_at).toLocaleString()} ·{' '}
                  {historyLabels[h.action]?.[en ? 1 : 0] || h.action}
                  {h.data.reason ? ' · ' + h.data.reason : ''}
                </p>
              ))}
            </div>
            <OrderSummary order={order} en={en} />
          </div>
        </>
      ) : kind === 'cart' ? (
        <>
          {rows.length === 0 ? (
            <p>{t('购物车为空', 'Your cart is empty')}</p>
          ) : (
            rows.map((r) => (
              <div
                className="panel cart-item"
                key={r.id}
                style={{ padding: 20, marginBottom: 12 }}
              >
                <ProductImage
                  src={r.imageId ? '/api/media/' + r.imageId : ''}
                  en={en}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, r.id]
                          : selected.filter((x) => x !== r.id),
                      )
                    }
                  />
                  <b>{en ? r.titleEn : r.titleZh}</b>
                </label>
                <p>
                  SPU: {r.spu || '—'}
                  <br />
                  {(r.specs || [])
                    .map(
                      (s: any) =>
                        `${en ? s.nameEn : s.nameZh}: ${s.values.map((v: any) => (en ? v.nameEn : v.nameZh)).join('/')}`,
                    )
                    .join(' · ') || t('标准款', 'Standard')}{' '}
                  ·{' '}
                  {r.variantData?.priceMinor != null
                    ? money(r.variantData.priceMinor, r.currency)
                    : t('当前不可购买', 'Unavailable')}
                </p>
                <input
                  type="number"
                  min={1}
                  max={999}
                  aria-label={t('数量', 'Quantity')}
                  value={r.quantity}
                  disabled={busy}
                  onChange={(e) => {
                    const quantity = Number(e.target.value);
                    if (quantity >= 1 && quantity <= 999)
                      run(async () => {
                        await ordersApi(
                          'cart-set',
                          {
                            productId: r.productId,
                            variant: r.variant,
                            quantity,
                          },
                          true,
                        );
                        await reload();
                      });
                  }}
                />
                <button aria-busy={Boolean(busy)}
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await ordersApi('cart-remove', { id: r.id }, true);
                      await reload();
                    })
                  }
                >
                  {t('移除', 'Remove')}
                </button>
              </div>
            ))
          )}
          {!!selectedRows.length && (
            <form
              className="checkout-layout"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const items = selectedRows.map((r) => ({
                    productId: r.productId,
                    variant: r.variant,
                    quantity: r.quantity,
                  }));
                  const fingerprint = JSON.stringify({ items, address, note });
                  if (attempt.current.fingerprint !== fingerprint)
                    attempt.current = { fingerprint, key: crypto.randomUUID() };
                  const result = await ordersApi(
                    'create',
                    {
                      requestKey: attempt.current.key,
                      items,
                      address,
                      note,
                      fromCart: true,
                    },
                    true,
                  );
                  behavior('order_submit');
                  location.href = `/${lang}/orders/${result.id}`;
                });
              }}
            >
              <div className="panel checkout-main">
                <h2>{t('确认订单', 'Checkout')}</h2>
                <h3>{t('收货信息', 'Shipping address')}</h3>
                <SavedAddressPicker refresh={addressRevision} value={address} onChange={setAddress} en={en}/>

                <button aria-busy={Boolean(busy)}
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const saved=await ordersApi('address-save', address, true);
                      setAddress({...address,id:saved.id});setAddressRevision(v=>v+1);
                      await reload();
                    })
                  }
                >
                  {t('保存到常用地址', 'Save address')}
                </button>
                {address.id && (
                  <button aria-busy={Boolean(busy)}
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        await ordersApi(
                          'address-delete',
                          { id: address.id },
                          true,
                        );
                        setAddress(emptyAddress);setAddressRevision(v=>v+1);
                        await reload();
                      })
                    }
                  >
                    {t('删除地址', 'Delete address')}
                  </button>
                )}
                <label className="field">
                  {t('买家备注', 'Order note')}
                  <textarea
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </div>
              <aside className="panel order-summary">
                <h3>{t('订单摘要', 'Order summary')}</h3>
                <p>
                  {selectedQuantity} {t('件商品', 'items')} · {selectedRows.length}{' '}
                  {t('个规格', 'variants')}
                </p>
                <p>
                  {t('商品金额', 'Items')}: {money(subtotal, currency)}　
                  {t('运费', 'Shipping')}: {money(shipping, currency)}
                </p>
                <h3>
                  {t('应付金额', 'Total')}:{' '}
                  {money(subtotal + shipping, currency)}
                </h3>
                <p>
                  {t(
                    '最终金额以提交时核验为准；不同币种请分开结算。',
                    'Prices are verified on submission. Check out different currencies separately.',
                  )}
                </p>
                <button aria-busy={Boolean(busy)}
                  className="btn primary"
                  disabled={
                    busy ||
                    !config?.enabled ||
                    !selectedRows.length ||
                    !addressComplete
                  }
                >
                  {busy
                    ? t('提交中…', 'Submitting…')
                    : t('提交订单', 'Place order')}
                </button>
              </aside>
            </form>
          )}
        </>
      ) : (
        <>
          <label className="field">
            {t('订单状态', 'Order status')}
            <select aria-label={t('订单类型','Order type')} value={orderType} onChange={e=>{setOrderType(e.target.value);setPage(1);}}><option value="">{t('全部订单','All orders')}</option><option value="cash">{t('普通订单','Purchases')}</option><option value="points">{t('兑换订单','Redemptions')}</option></select>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('全部状态', 'All statuses')}</option>
              {Object.entries(orderStatuses)
                .filter(([key]) => key !== 'building')
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {en ? stateEn[key] : String(label)}
                  </option>
                ))}
            </select>
          </label>
          {rows.map((r) => (
            <SiteLink
              className="panel"
              style={{ display: 'block', padding: 24, marginBottom: 12 }}
              key={r.id}
              href={`/${lang}/orders/${r.id}`}
            >
              <b>{r.order_number || r.id}</b>
              <p>
                {en ? stateEn[r.status] : (orderStatuses as any)[r.status]} ·{' '}
                {money(r.total, r.currency)} ·{' '}
                {new Date(r.created_at).toLocaleString()}
              </p>
            </SiteLink>
          ))}
          {!rows.length && <p>{t('暂无订单', 'No orders')}</p>}
          <div className="flex-actions">
            <button
              className="btn"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {t('上一页', 'Previous')}
            </button>
            {page}/{pages}
            <button
              className="btn"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              {t('下一页', 'Next')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
