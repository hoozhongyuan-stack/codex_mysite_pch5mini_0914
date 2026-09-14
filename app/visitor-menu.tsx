'use client';
import SiteLink from '../components/site-link';

import { useEffect, useState } from 'react';
export default function VisitorMenu({ lang }: { lang: string }) {
  const en = lang === 'en';
  const [user, setUser] = useState<any>(null),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const r = await fetch('/api/visitor/session', { cache: 'no-store' });
        if (!r.ok) throw Error();
        const d = (await r.json()) as any;
        if (active) {
          setUser(d.user);
          setLoaded(true);
        }
      } catch {
        if (active) setLoaded(true);
      }
    };
    sync();
    window.addEventListener('visitor-session-changed', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      active = false;
      window.removeEventListener('visitor-session-changed', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);
  if (!loaded)
    return (
      <span className="account-nav-link" aria-busy="true">
        {en ? 'Account…' : '账号…'}
      </span>
    );
  if (!user)
    return (
      <SiteLink className="account-nav-link" href={`/${lang}/account`}>
        {en ? 'Register / Sign in' : '注册 / 登录'}
      </SiteLink>
    );
  const email = String(user.email || '');
  const name =
    (en
      ? [user.firstName, user.lastName].filter(Boolean).join(' ')
      : [user.lastName, user.firstName].filter(Boolean).join('')) ||
    email.replace(/^(.).*(@.*)$/, '$1***$2');
  return (
    <details className="visitor-menu">
      <summary>
        <span className="visitor-avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span>{name}</span>
      </summary>
      <div className="visitor-dropdown">
        <SiteLink href={`/${lang}/account`}>{en ? 'Personal center' : '个人中心'}</SiteLink>
        <SiteLink href={`/${lang}/orders`}>{en ? 'My orders' : '我的订单'}</SiteLink>
        <SiteLink href={`/${lang}/account?section=favorites`}>{en ? 'Saved items' : '我的收藏'}</SiteLink>
        <SiteLink href={`/${lang}/account?section=points`}>{en ? 'My points' : '我的积分'}</SiteLink>
        <button
          type="button"
          onClick={async () => {
            try {
              const r = await fetch('/api/visitor/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
              });
              if (!r.ok) throw Error();
              window.dispatchEvent(new Event('visitor-session-changed'));
              location.href = `/${lang}/account`;
            } catch {
              setError(en ? 'Sign out failed. Try again.' : '退出失败，请重试');
            }
          }}
        >
          {en ? 'Sign out' : '退出登录'}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
