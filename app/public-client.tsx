'use client';
import SiteLink from '../components/site-link';

import {usePathname} from 'next/navigation';
import { behaviorChoiceKey, observeBehavior } from './behavior-client';
import { useProductSelection } from './product-options';
import { priceLabel } from '@/lib/product-options.mjs';
import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { legacyFields } from '@/lib/cms-domain.mjs';
export function ObserveVisit() {
  const pathname=usePathname();
  useEffect(() => {
    function report() {
      observeBehavior();
      if (
        !document.referrer ||
        localStorage.getItem('geo-cookie-choice') !== 'accepted'
      )
        return;
      fetch('/api/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: location.pathname,
          referrer: document.referrer,
        }),
      }).catch(() => {});
    }
    report();
    window.addEventListener('geo-cookie-update', report);
    return () => window.removeEventListener('geo-cookie-update', report);
  }, [pathname]);
  return null;
}
export function CookieChoice({
  en,
  hasPolicy = false,
}: {
  en: boolean;
  hasPolicy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(!localStorage.getItem(behaviorChoiceKey)); } catch {}
  }, []);
  const choose = (choice: string) => {
    localStorage.setItem('geo-cookie-choice', choice);
    localStorage.setItem(behaviorChoiceKey, choice);
    if(choice!=='accepted'){localStorage.removeItem('geo-behavior-visitor');sessionStorage.removeItem('geo-behavior-session');}
    setOpen(false);
    window.dispatchEvent(new Event('geo-cookie-update'));
  };
  return (
    <>
      <button className="cookie-settings" onClick={() => setOpen(true)}>
        {en ? 'Cookie preferences' : 'Cookie 偏好'}
      </button>
      {open && (
        <section
          className="cookie-banner"
          aria-label={en ? 'Cookie preferences' : 'Cookie 偏好'}
        >
          <p>
            {en
              ? 'Necessary cookies support sign-in and form uploads. Optional analytics record anonymous page views, reading, video watching, favorites and shopping steps, plus visits referred from AI services. You can withdraw at any time.'
              : '我们使用必要 Cookie 支持登录和表单上传。可选统计会记录匿名浏览、阅读、视频观看、收藏和购物步骤，以及来自 AI 服务的访问。不包含账号和表单内容，可随时关闭。'}{' '}
            {hasPolicy && (
              <SiteLink href={`/${en ? 'en' : 'zh'}/policies/cookies`}>
                {en ? 'Cookie policy' : '查看 Cookie 政策'}
              </SiteLink>
            )}
          </p>
          <div className="flex-actions">
            <button className="btn" onClick={() => choose('necessary')}>
              {en ? 'Necessary only' : '仅必要'}
            </button>
            <button className="btn primary" onClick={() => choose('accepted')}>
              {en ? 'Allow analytics' : '允许统计'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
export function PublicForm({
  formId,
  en,
  fields = legacyFields,
  formVersion,
  privacyVersion,
  sourceContentId,
  sourceEnd,
  sourcePage,
}: {
  formId: string;
  en: boolean;
  fields?: any[];
  formVersion?: string;
  privacyVersion?: number;
  sourceContentId?: string;
  sourceEnd?: string;
  sourcePage?: string;
}) {
  const context = useProductSelection();
  const product = context?.productId === sourceContentId ? context : null;
  const [state, setState] = useState(''),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [done, setDone] = useState(false),
    [uploads, setUploads] = useState<Record<string, any>>({}),
    [uploading, setUploading] = useState(0);
  async function upload(fieldId: string, file?: File) {
    if (!file) return;
    setUploads((s) =>
      Object.fromEntries(Object.entries(s).filter(([k]) => k !== fieldId)),
    );
    setUploading((n) => n + 1);
    setState('');
    try {
      const body = new FormData();
      body.set('formId', formId);
      body.set('fieldId', fieldId);
      body.set('file', file);
      const response = await fetch('/api/form-upload', {
          method: 'POST',
          body,
        }),
        data: any = await response.json();
      if (!response.ok)
        throw Error(
          en
            ? 'Image upload failed. Use JPG, PNG or WebP under 5MB.'
            : data.error,
        );
      setUploads((s) => ({ ...s, [fieldId]: data }));
    } catch (e) {
      setState((e as Error).message);
    } finally {
      setUploading((n) => n - 1);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setState('');
    if (product && !product.valid) {
      setState(
        en ? 'Please select all product options.' : '请先选择完整的商品规格。',
      );
      setBusy(false);
      return;
    }
    const form = e.currentTarget,
      values = {
        ...Object.fromEntries(new FormData(form)),
        ...Object.fromEntries(
          Object.entries(uploads).map(([k, v]) => [k, v.id]),
        ),
      };
    try {
      const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formId,
            formVersion,
            sourceContentId,
            sourceEnd: sourceEnd || new URLSearchParams(window.location.search).get("sourceEnd") || (window.matchMedia("(max-width: 767px)").matches ? "h5" : "pc"),
            sourcePage: sourcePage || new URLSearchParams(window.location.search).get("sourcePage") || window.location.pathname,
            ...(product
              ? {
                  productSelection: {
                    version: product.version,
                    selection: product.selection,
                  },
                }
              : {}),
            privacyVersion,
            values,
            language: en ? 'en' : 'zh',
            consent,
            website: values.website,
          }),
        }),
        data: any = await response.json();
      if (!response.ok)
        throw Error(
          en
            ? 'Please check your details. If this form was updated, refresh the page and try again.'
            : data.error,
        );
      if (data.pointsPending) setState(en ? 'Points are pending. Your submission has been saved.' : '积分暂待补发；表单已成功保存。');
      setDone(true);
    } catch (e) {
      setState((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return done ? (
    <div className="public-success" role="status">
      <h2>{en ? 'Thank you for reaching out.' : '感谢你的留言。'}</h2>
      {state && <p>{state}</p>}
      <p>{en ? 'Your message has been received.' : '你的信息已收到。'}</p>
    </div>
  ) : (
    <form className="public-form" onSubmit={submit}>
      {product && (
        <div className="inquiry-selection-summary" aria-live="polite">
          <b>{en ? 'Product inquiry' : '商品咨询'}</b>
          <p>
            {product.trade.specs
              .map((s: any, i: number) => {
                const v = s.values.find(
                  (v: any) => v.id === product.selection[i],
                );
                return (
                  (en ? s.nameEn : s.nameZh) +
                  ': ' +
                  (v
                    ? en
                      ? v.nameEn
                      : v.nameZh
                    : en
                      ? 'Not selected'
                      : '未选择')
                );
              })
              .join(' / ') || (en ? 'Standard product' : '默认商品')}
          </p>
          <p>
            {priceLabel(product.trade, product.valid ? product.key : '', en)}
          </p>
          {!product.valid && (
            <p>
              {en
                ? 'Please select all product options above before submitting.'
                : '请先在上方选择完整规格，再提交咨询。'}
            </p>
          )}
        </div>
      )}

      {fields.map((f) => (
        <label key={f.id} className={['textarea','image'].includes(f.type)?'form-wide':'form-short'}>
          {f.required && (
            <b className="required-mark" aria-hidden="true">
              *
            </b>
          )}
          {en ? f.labelEn : f.labelZh}
          {f.type === 'textarea' ? (
            <textarea
              name={f.id}
              required={f.required}
              maxLength={6000}
              placeholder={en ? f.placeholderEn : f.placeholderZh}
            />
          ) : f.type === 'image' ? (
            <>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required={f.required && !uploads[f.id]}
                disabled={!!uploading}
                onChange={(e) => upload(f.id, e.target.files?.[0])}
              />
              <small>
                {uploads[f.id]?.name ||
                  (en
                    ? 'JPG, PNG, WebP · up to 5 MB'
                    : 'JPG、PNG、WebP · 最大5MB')}
              </small>
            </>
          ) : (
            <input
              name={f.id}
              type={f.type === 'phone' ? 'tel' : f.type}
              required={f.required}
              min={f.min ?? undefined}
              max={f.max ?? undefined}
              step={f.type === 'number' ? 'any' : undefined}
              maxLength={1000}
              placeholder={en ? f.placeholderEn : f.placeholderZh}
            />
          )}
        </label>
      ))}
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="consent">
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          required
        />
        <span>
          <b className="required-mark" aria-hidden="true">
            *
          </b>
          {en
            ? 'I agree to the use of my information for this inquiry.'
            : '我同意使用我的信息处理本次咨询。'}{' '}
          <SiteLink
            href={`/${en ? 'en' : 'zh'}/policies/privacy`}
            target="_blank"
            rel="noreferrer"
          >
            {en ? 'Privacy policy' : '隐私协议'}
          </SiteLink>
        </span>
      </label>
      <button aria-busy={Boolean(busy)}
        className="public-button"
        disabled={
          busy || !consent || !!uploading || (!!product && !product.valid)
        }
      >
        {busy
          ? en
            ? 'Sending…'
            : '提交中…'
          : uploading
            ? en
              ? 'Uploading…'
              : '上传中…'
            : en
              ? 'Send message ↗'
              : '提交留言 ↗'}
      </button>
      {state && (
        <p role="alert" className="error">
          {state}
        </p>
      )}
    </form>
  );
}
