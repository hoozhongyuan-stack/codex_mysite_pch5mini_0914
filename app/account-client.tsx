'use client';
import SiteLink from '../components/site-link';

import MemberCenter from './member-center';
import PersonalPoints from './personal-points';
import { useEffect, useState } from 'react';
import SocialLogin from './social-login';
import { accountLink } from '@/lib/account-link.mjs';
import { safeShopReturn, accountLanguageHref } from '@/lib/shop-navigation.mjs';
import { Eye, EyeOff } from 'lucide-react';
export default function Account({
  en,
  policies,
}: {
  en: boolean;
  policies: any[];
}) {
  const [visiblePasswords, setVisiblePasswords] = useState<
    Record<string, boolean>
  >({});
  const [mode, setMode] = useState('login'),
    [token, setToken] = useState(''),
    [user, setUser] = useState<any>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user || accountLink(location.hash)) return;
    const back = safeShopReturn(new URLSearchParams(location.search).get('returnTo'));
    if (back) location.assign(back);
  }, [user]);
  const labels: any = {
    login: en ? 'Welcome back' : '欢迎回来',
    register: en ? 'Create your account' : '创建邮箱账号',
    forgot: en ? 'Forgot your password?' : '找回密码',
    reset: en ? 'Set a new password' : '设置新密码',
    verify: en ? 'Verify email and set password' : '验证邮箱并设置密码',
  };
  useEffect(() => {
    if(new URLSearchParams(location.search).get('oauthLinked')) setMessage(en?'Sign-in method linked successfully.':'快捷登录方式已绑定成功。');
    if(new URLSearchParams(location.search).get('oauthError')) setMessage(en?'Quick sign-in failed or was cancelled. Please try again or use another sign-in method.':'快捷登录未完成或已取消，请重试或使用其他登录方式。');
    const requestedMode = new URLSearchParams(location.search).get('mode');
    if (
      requestedMode &&
      ['login', 'register', 'forgot'].includes(requestedMode)
    )
      setMode(requestedMode);
    function readLink() {
      const link = accountLink(location.hash);
      if (link) {
        setMode(link.mode);
        setToken(link.token);
        setMessage('');
      }
    }
    readLink();
    window.addEventListener('hashchange', readLink);
    fetch('/api/visitor/session')
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        setUser(d.user);
      })
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false));
    return () => window.removeEventListener('hashchange', readLink);
  }, []);
  useEffect(() => {
    function switchLanguage(event: MouseEvent) {
      const link = (event.target as Element)?.closest?.(
        'a.language-switch',
      ) as HTMLAnchorElement | null;
      if (!link) return;
      const destination = new URL(link.href);
      const targetLang = destination.pathname.startsWith('/en/') ? 'en' : 'zh';
      const preserved = new URL(accountLanguageHref(targetLang, new URLSearchParams(location.search).get('returnTo')), location.origin);
      if (preserved.searchParams.has('returnTo')) destination.searchParams.set('returnTo', preserved.searchParams.get('returnTo')!);
      if (destination.origin !== location.origin) return;
      const section = new URLSearchParams(location.search).get('section');
      if (section && ['overview','points','favorites','settings','orders','events','addresses','watching'].includes(section)) destination.searchParams.set('section',section);
      const orderId = new URLSearchParams(location.search).get('order');
      if(orderId && section==='orders') destination.searchParams.set('order',orderId);
      if ((!user || mode === 'forgot') && ['login', 'register', 'forgot'].includes(mode))
        destination.searchParams.set('mode', mode);
      if (token && ['verify', 'reset'].includes(mode))
        destination.hash = new URLSearchParams({ [mode]: token }).toString();
      link.href = destination.href;
    }
    document.addEventListener('click', switchLanguage);
    return () => document.removeEventListener('click', switchLanguage);
  }, [mode, token, user]);
  const change = (m: string) => {
    if (accountLink(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
    setToken('');
    setMode(m);
    setVisiblePasswords({});
    setMessage('');
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const link = accountLink(location.hash);
    const activeToken = link?.mode === mode ? link.token : token;
    if (['verify', 'reset'].includes(mode) && !activeToken) {
      setMessage(en ? 'Open the complete link from your latest email.' : '请从最新邮件打开完整链接。');
      setBusy(false);
      return;
    }
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (
      values.password !== undefined &&
      values.confirm !== undefined &&
      values.password !== values.confirm
    ) {
      setMessage(en ? 'Passwords do not match' : '两次密码不一致');
      setBusy(false);
      return;
    }
    try {
      const response = await fetch('/api/visitor/' + mode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          lang: en ? 'en' : 'zh',
          token: activeToken,
          consent: values.consent === 'on',
          terms: policies.find((p) => p.kind === 'terms')?.version,
          privacy: policies.find((p) => p.kind === 'privacy')?.version,
        }),
      });
      const data: any = await response.json();
      if (!response.ok) throw Error(data.error);
      if (mode === 'login') setUser(data.user);
      else if (mode === 'verify' || mode === 'reset') {
        setMode('login');
        setToken('');
        history.replaceState(history.state, '', location.pathname + location.search);
        setMessage(
          en
            ? 'Password saved. You can now sign in.'
            : '密码已保存，现在可以登录。',
        );
      } else
        setMessage(
          en
            ? 'If eligible, an email has been sent. Check your inbox and spam folder.'
            : '若邮箱符合条件，邮件已发送。请检查收件箱和垃圾邮件，链接 30 分钟内有效。',
        );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { if (!loading) window.dispatchEvent(new Event('visitor-session-changed')); }, [user, loading]);
  async function logout() {
    setBusy(true);
    try {
      const r = await fetch('/api/visitor/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!r.ok) throw Error(en ? 'Sign out failed' : '退出失败');
      setUser(null);
      setMessage('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const field = (name: string, label: string, type = 'text', auto = '') => (
    <label className="field">
      <span>
        <b className="required-mark" aria-hidden="true">
          *
        </b>
        {label}
      </span>
      <div className={type === 'password' ? 'password-input-wrap' : undefined}>
        <input
          name={name}
          type={type === 'password' && visiblePasswords[name] ? 'text' : type}
          autoComplete={auto}
          required
          minLength={type === 'password' ? 6 : undefined}
          maxLength={type === 'password' ? 128 : name === 'email' ? 254 : 100}
        />
        {type === 'password' && (
          <button
            type="button"
            className="password-toggle"
            aria-label={
              visiblePasswords[name]
                ? en
                  ? 'Hide password'
                  : '隐藏密码'
                : en
                  ? 'Show password'
                  : '显示密码'
            }
            aria-pressed={!!visiblePasswords[name]}
            onClick={() =>
              setVisiblePasswords((current) => ({
                ...current,
                [name]: !current[name],
              }))
            }
          >
            {visiblePasswords[name] ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </label>
  );
  if (!loading && user && !['verify', 'reset', 'forgot'].includes(mode)) return <MemberCenter user={user} policies={policies} onUser={setUser} en={en} logout={logout} busy={busy} message={message} />;
  return (
    <main className="account-page">
      <section className="account-story">
        <p className="eyebrow">YOUR CONNECTION STARTS HERE</p>
        <h1>
          {en
            ? 'A place for new perspectives.'
            : '从一次相遇，\n开启更多可能。'}
        </h1>
        <p>
          {en
            ? 'Discover our stories and products with your own account.'
            : '用你的邮箱，连接品牌内容与产品灵感。'}
        </p>
      </section>
      <section className="account-card">
        {!loading && !['verify', 'reset'].includes(mode) && (!user && ['login', 'register'].includes(mode)) && (
          <SocialLogin
            en={en}
            policies={policies}
            user={user}
            onUser={setUser}
          />
        )}
        {loading ? (
          <p>{en ? 'Loading…' : '正在读取账号…'}</p>
        ) : user && !['verify', 'reset', 'forgot'].includes(mode) ? (
          <>
            <span className="pill green">{en ? 'Signed in' : '已登录'}</span>
            <h2>
              {en
                ? `Hello, ${user.firstName}`
                : `你好，${user.lastName}${user.firstName}`}
            </h2>
            <p>{user.email}</p>
            <PersonalPoints en={en} />
            <SiteLink className="btn" href={`/${en ? 'en' : 'zh'}/articles`}>
              {en ? 'Explore stories' : '浏览文章'} ↗
            </SiteLink>
            <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={logout}>
              {en ? 'Sign out' : '退出登录'}
            </button>
          </>
        ) : (
          <>
            <h2>{labels[mode]}</h2>
            <p className="muted">
              {mode === 'verify'
                ? en
                  ? 'Choose your password to finish email verification.'
                  : '请设置密码，完成邮箱验证。'
                : en
                  ? 'Use your email to continue.'
                  : '使用邮箱继续。'}
            </p>
            <form key={mode} onSubmit={submit}>
              {mode === 'register' && (
                <div className="field-grid">
                  {field(
                    'lastName',
                    en ? 'Last name' : '姓',
                    'text',
                    'family-name',
                  )}
                  {field(
                    'firstName',
                    en ? 'First name' : '名',
                    'text',
                    'given-name',
                  )}
                </div>
              )}
              {!['verify', 'reset'].includes(mode) &&
                field('email', en ? 'Email' : '邮箱', 'email', 'email')}
              {!['forgot', 'register'].includes(mode) &&
                field(
                  'password',
                  en ? 'Password (6–128 characters)' : '密码（6–128 位）',
                  'password',
                  mode === 'login' ? 'current-password' : 'new-password',
                )}
              {['verify', 'reset'].includes(mode) &&
                field(
                  'confirm',
                  en ? 'Confirm password' : '确认密码',
                  'password',
                  'new-password',
                )}
              {mode === 'register' && (
                <label className="consent">
                  <input type="checkbox" name="consent" required />
                  <span>
                    <b className="required-mark" aria-hidden="true">
                      *
                    </b>
                    {en ? 'I agree to the ' : '我已阅读并同意'}
                    <SiteLink
                      href={`/${en ? 'en' : 'zh'}/policies/terms`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {en ? 'Terms' : '注册协议'}
                    </SiteLink>
                    {en ? ' and ' : '及'}
                    <SiteLink
                      href={`/${en ? 'en' : 'zh'}/policies/privacy`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {en ? 'Privacy policy' : '隐私协议'}
                    </SiteLink>
                  </span>
                </label>
              )}
              <button aria-busy={Boolean(busy)} className="public-button" disabled={busy}>
                {busy ? (en ? 'Please wait…' : '处理中…') : labels[mode]} ↗
              </button>
            </form>
            {['verify', 'reset'].includes(mode) && <p className="muted">{en ? 'Links expire in 30 minutes and can only be used once. Please use the latest email.' : '链接30分钟内有效且只能使用一次，请使用最新邮件。'}</p>}
            <div className="account-links">
              {['verify', 'reset'].includes(mode) && <button onClick={() => change(mode === 'verify' ? 'register' : 'forgot')}>{en ? 'Request a new email' : '重新申请邮件'}</button>}
              {mode !== 'login' && (
                <button onClick={() => change('login')}>
                  {en ? 'Back to sign in' : '返回登录'}
                </button>
              )}
              {mode === 'login' && (
                <>
                  <button onClick={() => change('register')}>
                    {en ? 'Create an account' : '注册账号'}
                  </button>
                  <button onClick={() => change('forgot')}>
                    {en ? 'Forgot password' : '忘记密码'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
