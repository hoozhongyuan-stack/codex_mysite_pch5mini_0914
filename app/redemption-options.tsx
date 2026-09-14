'use client';
import SiteLink from '../components/site-link';

import { useEffect, useRef, useState } from 'react';
import { useProductSelection } from './product-context';
import { SavedAddressPicker, blankAddress } from './address-book';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  redemptionPoints,
  redemptionDetailHref,
} from '@/lib/redemption-view.mjs';
import './points-store.css';
export default function RedemptionOptions({
  en,
  slug,
}: {
  en: boolean;
  slug: string;
}) {
  const product = useProductSelection();
  const [row, setRow] = useState<any>(null),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState(''),
    [quantity, setQuantity] = useState(1),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [address, setAddress] = useState<any>({ ...blankAddress });
  const attempt = useRef({ fingerprint: '', key: '' });
  const t = (zh: string, eng: string) => (en ? eng : zh),
    lang = en ? 'en' : 'zh';
  useEffect(() => {
    let active = true;
    fetch('/api/mall/list')
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) {
          setRow(d.rows.find((x: any) => x.id === product?.productId) || null);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) {
          setMessage(e.message);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [product?.productId]);
  if (!product) return null;
  const { selection, setSelection, key, valid } = product,
    points = redemptionPoints(row, valid ? key : '');
  const maxQuantity = Math.min(999, row?.remainingQuota ?? 999, row?.limit || 999);
  const available =
    !!row && !row.soldOut && valid && redemptionPoints(row, key) !== null;
  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!available || busy) return;
    setBusy(true);
    setMessage('');
    const input = {
      productId: product!.productId,
      variant: key,
      quantity,
      address,
    };
    const fingerprint = JSON.stringify(input);
    if (attempt.current.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const r = await fetch('/api/mall/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, requestKey: attempt.current.key }),
      });
      const d: any = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          location.href = `/${lang}/account?returnTo=${encodeURIComponent(redemptionDetailHref(lang, slug))}`;
          return;
        }
        if (r.status === 400) attempt.current = { fingerprint: '', key: '' };
        throw Error(d.error);
      }
      location.href = `/${lang}/orders/${d.id}`;
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="product-purchase-options redemption-options"
      aria-label={t('积分兑换', 'Points redemption')}
    >
      <SiteLink className="redemption-back" href={`/${lang}/points-shop`}>
        {t('← 积分商城', '← Points shop')}
      </SiteLink>
      <div className="product-price">
        {points ?? '—'}{' '}
        <small>
          {t('积分', 'points')}
          {!valid && row?.specs?.length ? t('起', ' and up') : ''}
        </small>
      </div>
      <p className="redemption-note">
        {t('纯积分兑换 · 包邮配送', 'Points only · Free shipping')}
      </p>
      {row?.specs.map((spec: any, i: number) => (
        <fieldset key={spec.id}>
          <legend>{en ? spec.nameEn : spec.nameZh}</legend>
          <div className="option-values">
            {spec.values.map((value: any) => {
              const enabled = row.variants.some(
                (v: any) =>
                  v.key.split('~').includes(value.id) &&
                  selection.every(
                    (s, j) => j === i || !s || v.key.split('~').includes(s),
                  ),
              );
              return (
                <button
                  type="button"
                  key={value.id}
                  disabled={!enabled}
                  aria-pressed={selection[i] === value.id}
                  onClick={() =>
                    setSelection(
                      selection.map((s, j) => (j === i ? value.id : s)),
                    )
                  }
                >
                  {en ? value.nameEn : value.nameZh}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {row && (
        <p className="redemption-note">
          {row.limit
            ? t(`每人累计限兑 ${row.limit} 件`, `Limit ${row.limit} per person`)
            : t('不限个人兑换数量', 'No per-person limit')}{' '}
          ·{' '}
          {t(
            `剩余兑换配额 ${row.remainingQuota ?? '—'} 件`,
            `Remaining quota: ${row.remainingQuota ?? '—'}`,
          )}
        </p>
      )}
      <label className="redemption-quantity">
        {t('数量', 'Quantity')}
        <input
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </label>
      <button
        type="button"
        className="btn redemption-primary"
        disabled={!available || !Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity}
        onClick={() => {
          setMessage('');
          setOpen(true);
        }}
      >
        {!loaded
          ? t('加载中…', 'Loading…')
          : !row
            ? t('暂未开放兑换', 'Redemption unavailable')
            : row.soldOut
              ? t('已兑完', 'Sold out')
              : !valid
                ? t('请选择完整规格', 'Select all options')
                : t('立即兑换', 'Redeem now')}
      </button>
      {message && !open && <p role="alert">{message}</p>}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent className="redemption-checkout">
          <DialogHeader>
            <DialogTitle>{t('确认兑换', 'Confirm redemption')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={redeem}>
            <p>
              {en ? row?.titleEn : row?.titleZh} × {quantity}
            </p>
            <SavedAddressPicker value={address} onChange={setAddress} en={en} />
            <div className="redemption-total">
              <span>{t('合计 · 包邮', 'Total · Free shipping')}</span>
              <strong>
                {(points || 0) * quantity} {t('积分', 'points')}
              </strong>
            </div>
            {message && (
              <p role="alert" className="notice">
                {message}
              </p>
            )}
            <div className="redemption-actions">
              <button aria-busy={Boolean(busy)}
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t('取消', 'Cancel')}
              </button>
              <button aria-busy={Boolean(busy)} className="btn redemption-primary" disabled={busy}>
                {busy
                  ? t('处理中…', 'Processing…')
                  : t('确认扣积分并兑换', 'Confirm redemption')}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
