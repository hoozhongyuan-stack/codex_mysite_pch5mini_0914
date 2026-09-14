'use client';
import SiteLink from '../components/site-link';

import { useEffect, useState } from 'react';
import {
  UserRound,
  Package,
  Bookmark,
  Coins,
  CalendarDays,
  Settings,
  ArrowUpRight,
  MapPin,
  History,
} from 'lucide-react';
import ShopClient from './shop-client';
import SalonPublic from './salon-public';
import VideoPublic from './video-public';
import AddressBook from './address-book';
import SocialLogin from './social-login';
import PersonalPoints from './personal-points';
export default function MemberCenter({ user, en, logout, busy, message, policies=[], onUser }: any) {
  const [tab, setTab] = useState('overview'),
    [summary, setSummary] = useState<any>(null),
    [summaryError, setSummaryError] = useState(''),
    [retry, setRetry] = useState(0);
  const lang = en ? 'en' : 'zh',
    t = (zh: string, english: string) => (en ? english : zh);
  useEffect(() => {
    const sync = () => {
      const value =
        new URLSearchParams(location.search).get('section') || 'overview';
      setTab(
        [
          'overview',
          'points',
          'favorites',
          'settings',
          'orders',
          'events',
          'addresses',
          'watching',
        ].includes(value)
          ? value
          : 'overview',
      );
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    setSummaryError('');
    fetch('/api/points/summary')
      .then((r) => {
        if (!r.ok)
          throw Error(
            t('积分读取失败，请重试', 'Unable to load points. Please retry.'),
          );
        return r.json();
      })
      .then(setSummary)
      .catch((e) => setSummaryError(e.message));
  }, [retry]);
  const navigate = (key: string) => {
    setTab(key);
    history.replaceState(null, '', `/${lang}/account?section=${key}`);
  };
  const name = en
    ? [user.firstName, user.lastName].join(' ')
    : `${user.lastName || ''}${user.firstName || ''}`;
  const entries = [
    ['overview', '账户概览', 'Overview', UserRound],
    ['orders', '我的订单', 'My orders', Package],
    ['favorites', '我的收藏', 'Saved items', Bookmark],
    ['points', '我的积分', 'My points', Coins],
    ['events', '我的活动', 'My events', CalendarDays],
    ['addresses', '我的地址', 'My addresses', MapPin],
    ['watching', '最近观看', 'Recently watched', History],
    ['settings', '账户设置', 'Settings', Settings],
  ] as const;
  return (
    <main className="member-center">
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
      {summaryError && (
        <p role="alert">
          {summaryError}{' '}
          <button className="btn" onClick={() => setRetry(retry + 1)}>
            {t('重试', 'Retry')}
          </button>
        </p>
      )}
      <header className="member-profile">
        <span className="member-avatar">{name.slice(0, 1) || 'U'}</span>
        <div>
          <p>{t('个人中心', 'Personal center')}</p>
          <h1>
            {t('你好，', 'Hello, ')}
            {name}
          </h1>
          <p>
            {user.email}{' '}
          </p>
        </div>
      </header>
      <div className="member-layout">
        <nav
          className="member-nav"
          aria-label={t('个人中心导航', 'Personal navigation')}
        >
          {entries.map(([key, zh, english, Icon]) => (
            <SiteLink
              key={key}
              aria-current={tab === key ? 'page' : undefined}
              href={`/${lang}/account?section=${key}`}
            >
              <Icon size={18} />
              {t(zh, english)}
            </SiteLink>
          ))}
        </nav>
        <section className="member-panel">
          {tab === 'orders' ? (
            <ShopClient
              embedded
              lang={lang}
              kind="orders"
              id={
                typeof window === 'undefined'
                  ? ''
                  : new URLSearchParams(location.search).get('order') || ''
              }
            />
          ) : tab === 'events' ? (
            <SalonPublic embedded lang={lang} id="mine" />
          ) : tab === 'watching' ? (
            <VideoPublic embedded lang={lang} id="mine" />
          ) : tab === 'addresses' ? (
            <AddressBook en={en} />
          ) : tab === 'points' || tab === 'favorites' ? (
            <PersonalPoints key={tab} en={en} favorites={tab === 'favorites'} />
          ) : tab === 'settings' ? (
            <>
              <h2>{t('账户设置', 'Account settings')}</h2>
              <div className="member-record">
                <span>{t('姓名', 'Name')}</span>
                <b>{name}</b>
              </div>
              <div className="member-record">
                <span>{t('邮箱', 'Email')}</span>
                <b>{user.email}</b>
              </div>
              <SocialLogin en={en} user={user} policies={policies} onUser={onUser} />
              <p className="muted">
                {t(
                  '通过邮箱验证安全重置密码。',
                  'Reset your password securely through email verification.',
                )}
              </p>
              <SiteLink className="btn" href={`/${lang}/account?mode=forgot`}>
                {t('重置密码', 'Reset password')}
              </SiteLink>
              <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={logout}>
                {t('退出登录', 'Sign out')}
              </button>
            </>
          ) : (
            <>
              <div className="member-heading">
                <h2>{t('账户概览', 'Overview')}</h2>
                <SiteLink href={`/${lang}/account?section=watching`}>
                  {t('最近观看', 'Recently watched')} ↗
                </SiteLink>
              </div>
              <div className="member-balance">
                <div>
                  <span>{t('可用积分', 'Available points')}</span>
                  <strong>{summary?.balance ?? '—'}</strong>
                </div>
                <SiteLink className="btn primary" href={`/${lang}/points-shop`}>
                  {t('去兑换', 'Redeem')}
                  <ArrowUpRight size={16} />
                </SiteLink>
              </div>
              <div className="member-shortcuts">
                {entries.slice(1, 5).map(([key, zh, english, Icon]) => (
                  <SiteLink
                    key={key}
                    href={
                      key === 'orders'
                        ? `/${lang}/orders`
                        : key === 'events'
                          ? `/${lang}/events/mine`
                          : `/${lang}/account?section=${key}`
                    }
                  >
                    <Icon size={24} />
                    <b>{t(zh, english)}</b>
                    <span>{t('查看详情', 'View details')} ↗</span>
                  </SiteLink>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
