'use client';
import { useState } from 'react';
import { AdminFormActions, useAdminDialogSaved } from './admin-dialog';
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
  const profileSaved = useAdminDialogSaved('visitor-profile');
  const phoneSaved = useAdminDialogSaved('visitor-phone');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [phoneReview, setPhoneReview] = useState(user.phoneReviewStatus || 'not_authorized');
  const names = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
  return (
    <form
      className="panel"
      data-admin-draft-scope="visitor-profile"
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
          profileSaved();
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
      <p>微信手机号：{user.phoneMasked || '未授权'}{user.phoneVerified ? '（已授权）' : ''}</p>
      <p className="muted">手机号仅以脱敏形式展示，后台不能查看、修改或导出完整号码。</p>
      {user.phoneVerified && <label className="field" data-admin-draft-scope="visitor-phone"><span>手机号审核状态</span><select value={phoneReview} onChange={(e) => setPhoneReview(e.target.value)}><option value="unreviewed">待审核</option><option value="approved">已确认</option><option value="follow_up">需跟进</option></select><button type="button" className="btn" disabled={busy} onClick={async () => { setBusy(true); try { const r = await fetch('/api/identity-admin/review-user-phone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, status: phoneReview }) }); const d: any = await r.json(); if (!r.ok) throw Error(d.error); phoneSaved(); onSaved(d.user); setMessage(d.warning || '手机号审核状态已保存'); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } }}>保存手机号审核</button></label>}
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
      <AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
        保存访客资料
      </button></AdminFormActions>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
