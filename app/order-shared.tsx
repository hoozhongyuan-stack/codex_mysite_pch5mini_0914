'use client';
import SiteLink from '../components/site-link';

import { useState } from 'react';
import { orderErrorText } from '@/lib/shop-navigation.mjs';
export async function ordersApi(action: string, data: any = {}, write = false) {
  const r = await fetch(
      '/api/orders/' + action + (write ? '' : '?' + new URLSearchParams(data)),
      write
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }
        : undefined,
    ),
    d = (await r.json()) as any;
  if (!r.ok)
    throw Object.assign(new Error(d.error || '请求失败'), { status: r.status });
  return d;
}
export const money = (minor: number, currency: string) =>
  currency === 'PTS' ? `${minor} 积分` : new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(
    minor / 100,
  );
export const stateEn: any = {
  pending_payment: 'Awaiting payment',
  pending_review: 'Payment review',
  pending_ship: 'Awaiting shipment',
  pending_receive: 'Awaiting receipt',
  aftersale: 'After-sales',
  completed: 'Completed',
  closed: 'Closed',
};
export function OrderFileUpload({
  orderId,
  purpose = 'payment',
  files,
  onChange,
  en = false,
  maxFiles = 6,
}: any) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="field">
      <label>
        {en ? `Images (up to ${maxFiles})` : `图片凭证（最多${maxFiles}张）`}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || files.length >= maxFiles}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const body = new FormData();
              body.set('file', file);
              body.set('purpose', purpose);
              const r = await fetch('/api/order-files/' + orderId, {
                  method: 'POST',
                  body,
                }),
                d = (await r.json()) as any;
              if (!r.ok) throw Error(d.error);
              onChange([...files, d.id]);
              setError('');
            } catch (e: any) {
              setError(orderErrorText(e, en));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {files.map((id: string) => (
        <div key={id}>
          <SiteLink href={'/api/order-files/' + id} target="_blank" rel="noreferrer">
            <img
              className="proof-thumbnail"
              src={'/api/order-files/' + id}
              alt={en ? 'Payment proof' : '付款凭证'}
            />
          </SiteLink>{' '}
          <button
            type="button"
            className="btn"
            onClick={() => onChange(files.filter((x: string) => x !== id))}
          >
            {en ? 'Remove' : '移除'}
          </button>
        </div>
      ))}
      {busy && <small>{en ? 'Uploading…' : '上传中…'}</small>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrderNumber({ order, en = false }: any) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="order-number">
      <span>{order.order_number || order.id}</span>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(order.order_number || order.id);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? (en ? 'Copied' : '已复制') : en ? 'Copy' : '复制'}
      </button>
    </span>
  );
}
export function ProductImage({ src, en = false }: any) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      className="order-product-image"
      src={src}
      alt={en ? 'Product' : '商品缩略图'}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="order-product-image image-placeholder">
      {en ? 'No image' : '暂无图片'}
    </span>
  );
}
export function OrderItems({ order, en = false }: any) {
  return (
    <section className="panel order-items">
      <h3>{en ? 'Items' : '商品清单'}</h3>
      {order.items.map((i: any) => (
        <div className="order-item" key={i.id}>
          <ProductImage
            en={en}
            src={
              i.snapshot.imageId
                ? `/api/order-item-image/${order.id}/${i.snapshot.imageId}`
                : ''
            }
          />
          <div className="order-item-description">
            <b>
              {(en ? i.snapshot.titleEn : i.snapshot.titleZh) ||
                i.snapshot.titleZh}
            </b>
            <p>SPU：{i.snapshot.spu || '—'}</p>
            <p>
              {(i.snapshot.specs || [])
                .map(
                  (s: any) =>
                    `${(en ? s.nameEn : s.nameZh) || s.nameZh}: ${s.values.map((v: any) => (en ? v.nameEn : v.nameZh) || v.nameZh).join('/')}`,
                )
                .join(' · ') || (en ? 'Standard' : '标准款')}
            </p>
          </div>
          <div className="order-item-price">
            <span>
              {money(i.unit_price, order.currency)} × {i.quantity}
            </span>
            <strong>{money(i.unit_price * i.quantity, order.currency)}</strong>
          </div>
        </div>
      ))}
    </section>
  );
}
export function OrderSummary({ order, en = false }: any) {
  return (
    <aside className="panel order-summary">
      <h3>{en ? 'Order summary' : '订单摘要'}</h3>
      <OrderNumber order={order} en={en} />
      <p>{new Date(order.created_at).toLocaleString(en ? 'en-US' : 'zh-CN')}</p>
      <dl>
        <div>
          <dt>{en ? 'Items' : '商品金额'}</dt>
          <dd>{money(order.subtotal, order.currency)}</dd>
        </div>
        <div>
          <dt>{en ? 'Shipping' : '运费'}</dt>
          <dd>{money(order.shipping, order.currency)}</dd>
        </div>
        <div className="order-total">
          <dt>{en ? 'Total' : '应付金额'}</dt>
          <dd>{money(order.total, order.currency)}</dd>
        </div>
      </dl>
      {order.status === 'pending_payment' && (
        <p>
          {en ? 'Pay before: ' : '付款截止：'}
          {new Date(order.expires_at).toLocaleString(en ? 'en-US' : 'zh-CN')}
        </p>
      )}
    </aside>
  );
}
export const historyLabels: any = {
  'redeem-create': ['创建积分兑换订单', 'Redemption created'],
  'redeem-cancel': ['取消积分兑换', 'Redemption cancelled'],
  create: ['创建订单', 'Order created'],
  proof: ['提交付款凭证', 'Payment proof submitted'],
  approve: ['确认收款', 'Payment confirmed'],
  reject: ['驳回付款凭证', 'Payment proof rejected'],
  ship: ['订单发货', 'Order shipped'],
  logistics: ['更新物流', 'Shipment updated'],
  receive: ['确认签收', 'Receipt confirmed'],
  aftersale: ['申请售后', 'After-sales requested'],
  withdraw: ['撤销售后', 'Request withdrawn'],
  refund: ['登记退款', 'Refund recorded'],
  reject_aftersale: ['驳回售后', 'After-sales rejected'],
  restock: ['返还库存', 'Stock restored'],
  note: ['内部备注', 'Internal note'],
  close: ['关闭订单', 'Order closed'],
  cancel: ['取消订单', 'Order cancelled'],
  expire: ['超时关闭', 'Payment expired'],
};
