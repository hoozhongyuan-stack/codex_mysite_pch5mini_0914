'use client';
import { useState } from 'react';
export const sourceLabels: Record<string, string> = {
  email: '邮箱注册',
  unknown: '历史来源未知',
  google: 'Google',
  facebook: 'Facebook',
  wechat: '微信',
  'sandbox:google': 'Google（沙箱）',
  'sandbox:wechat': '微信（沙箱）',
  'sandbox:facebook': 'Facebook（沙箱）',
};
export default function VisitorProfile({ user, onSaved }: any) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const names = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
  return (
    <form
      className="panel"
      style={{ padding: 18 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          const r = await fetch('/api/identity-admin/save-user-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.id,
              country: String(f.get('country') || '').toUpperCase(),
              city: f.get('city'),
              company: f.get('company'),
            }),
          });
          const d: any = await r.json();
          if (!r.ok) throw Error(d.error);
          onSaved(d.user);
          setMessage(d.warning || '访客资料已保存');
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>后台维护资料</h3>
      <p>
        注册来源：
        {sourceLabels[user.registrationSource] || user.registrationSource}
      </p>
      <p>
        最近登录方式：
        {sourceLabels[user.lastLoginMethod] || user.lastLoginMethod || '未记录'}
      </p>
      <p>已绑定渠道：{user.providers?.join(' / ') || '无'}</p>
      {user.sandbox && (
        <p role="status" className="notice">沙箱测试账号，未经过真实平台授权或邮箱验证。</p>
      )}
      <label className="field">
        <span>国家 / 地区（可留空）</span>
        <input
          name="country"
          list="visitor-countries"
          placeholder="选择或输入两位国家代码，如 CN"
          maxLength={2}
          pattern="[A-Za-z]{2}"
          defaultValue={user.country}
        />
        <datalist id="visitor-countries">
          {'CN HK MO TW US CA GB AU NZ SG MY TH VN ID PH JP KR IN DE FR IT ES NL CH SE NO DK FI RU BR MX AE SA ZA'
            .split(' ')
            .map((code) => (
              <option value={code} key={code}>
                {names.of(code)}
              </option>
            ))}
        </datalist>
      </label>
      <label className="field">
        <span>城市</span>
        <input name="city" maxLength={100} defaultValue={user.city} />
      </label>
      <label className="field">
        <span>公司名称</span>
        <input name="company" maxLength={200} defaultValue={user.company} />
      </label>
      <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
        保存访客资料
      </button>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
