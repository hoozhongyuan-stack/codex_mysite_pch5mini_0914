'use client';
import { useState } from 'react';
import Particles from './particles';
import PasswordField from './password-field';
import SiteLink from '@/components/site-link';
import '../../admin-compact.css';
export default function StaffLogin({ profile = false }: any) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <main className={profile ? "admin-workspace admin-profile" : "staff-login"}>
      {!profile && <Particles />}
      <form
        className={profile ? "panel workspace admin-profile-panel" : "panel"}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const data = Object.fromEntries(new FormData(e.currentTarget));
            const r = await fetch(
              '/api/staff/' + (profile ? 'profile' : 'login'),
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              },
            );
            const d = (await r.json()) as any;
            if (!r.ok) throw Error(d.error);
            location.href = profile
              ? '/admin/login'
              : d.user.mustChange
                ? '/admin/profile'
                : '/admin';
          } catch (e: any) {
            setMessage(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {profile && <SiteLink className="btn" href="/admin">返回工作台</SiteLink>}
        <h1>{profile ? '修改管理员账号与密码' : '管理后台'}</h1>
        <p className="muted">
          {profile
            ? '首次登录必须修改初始密码。修改后需重新登录。'
            : '使用本站管理员账号登录'}
        </p>
        <label className="field">
          用户名
          <input
            name="username"
            required
            minLength={3}
            autoComplete="username"
          />
        </label>
        {profile && (
          <PasswordField
            name="oldPassword"
            label="当前密码"
            autoComplete="current-password"
          />
        )}
        <PasswordField
          name="password"
          label={profile ? '新密码' : '密码'}
          minLength={profile ? 10 : undefined}
          autoComplete={profile ? 'new-password' : 'current-password'}
        />
        <div className="staff-login-actions">
          <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
            {busy ? '处理中…' : profile ? '保存并重新登录' : '登录'}
          </button>
        </div>
        {message && (
          <p className="error" role="alert">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
