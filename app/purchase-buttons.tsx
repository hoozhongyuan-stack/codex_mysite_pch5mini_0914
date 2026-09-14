'use client';
import {behavior} from './behavior-client';
import { useEffect, useState } from 'react';
import { useProductSelection } from './product-context';
import { orderErrorText } from '@/lib/shop-navigation.mjs';
import { ordersApi } from './order-shared';
export default function PurchaseButtons({ en }: any) {
  const p = useProductSelection(),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [quantity, setQuantity] = useState(1),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    ordersApi('availability')
      .then((d) => setEnabled(d.enabled))
      .catch((e) => setMessage(orderErrorText(e, en)));
  }, []);
  if (!p) return null;
  if (!enabled) return <p className="notice" role="status">{message || (enabled === null ? (en ? 'Checking availability…' : '正在读取交易状态…') : (en ? 'Purchasing is currently unavailable. You can still view your orders from the navigation.' : '暂未开放购买，可通过顶部入口查看已有订单。'))}</p>;
  const can =
    p.valid &&
    p.trade.variants.find((v: any) => v.key === p.key)?.priceMinor != null;
  async function add(direct: boolean) {
    setBusy(true);
    try {
      await ordersApi(
        'cart-add',
        { productId: p!.productId, variant: p!.key, quantity },
        true,
      );
      behavior('cart_add',p!.productId);
      if (direct) location.href = `/${en ? 'en' : 'zh'}/cart?product=${encodeURIComponent(p!.productId)}&variant=${encodeURIComponent(p!.key)}`;
      else setMessage(en ? 'Added to cart' : '已加入购物车');
    } catch (e: any) {
      if (e.status === 401) location.href = `/${en ? 'en' : 'zh'}/account?returnTo=${encodeURIComponent(location.pathname)}`;
      else setMessage(orderErrorText(e, en));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section style={{ marginTop: 20 }}>
      <label>
        {en ? 'Quantity' : '数量'}{' '}
        <input
          aria-label={en ? 'Quantity' : '数量'}
          type="number"
          min={1}
          max={999}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          style={{ width: 80 }}
        />
      </label>
      <div className="flex-actions" style={{ marginTop: 12 }}>
        <button aria-busy={Boolean(busy)}
          className="btn"
          disabled={!can || busy}
          onClick={() => add(false)}
        >
          {en ? 'Add to cart' : '加入购物车'}
        </button>
        <button aria-busy={Boolean(busy)}
          className="btn primary"
          disabled={!can || busy}
          onClick={() => add(true)}
        >
          {en ? 'Buy now' : '立即购买'}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
