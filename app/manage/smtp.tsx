'use client';
import { AdminFormActions } from './admin-dialog';
import { useEffect, useState } from 'react';
import { Field, Choice } from './shared';
export default function SmtpSettings({onSaved}:any) {
  const [data, setData] = useState<any>({
      host: 'smtp.163.com',
      port: 465,
      username: '',
      sender: '',
      senderName: 'GEO Studio',
      enabled: false,
      password: '',
    }),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [to, setTo] = useState('');
  useEffect(() => {
    fetch('/api/identity-admin/smtp')
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        setData((s: any) => ({ ...s, ...d, password: '' }));
      })
      .catch((e) => setMessage(e.message));
  }, []);
  const set = (k: string, v: any) => setData((s: any) => ({ ...s, [k]: v }));
  async function action(name: string, payload: any) {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/identity-admin/' + name, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      if (name === 'save-smtp') {setData({ ...d, password: '' });onSaved?.();}
      setMessage(
        name === 'save-smtp'
          ? 'SMTP 设置已保存'
          : '测试邮件已提交给 SMTP 服务器，请检查收件箱',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel" style={{ marginTop: 24 }}>
      <h2>邮箱与 SMTP</h2>
      <p className="muted">
        用于访客邮箱验证和密码找回。授权码留空则保留原值，保存后不回显。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action('save-smtp', data);
        }}
      >
        <div className="field-grid">
          <Field
            label="SMTP 主机"
            value={data.host}
            required
            onChange={(v: string) => set('host', v)}
          />
          <Choice
            label="安全连接"
            value={String(data.port)}
            onChange={(v: string) => set('port', Number(v))}
            items={[
              ['465', 'SSL · 465'],
              ['587', 'STARTTLS · 587'],
            ]}
          />
        </div>
        <Field
          label="SMTP 登录账号"
          value={data.username}
          required
          onChange={(v: string) => set('username', v)}
        />
        <Field
          label={
            data.passwordConfigured ? '授权码（已配置，留空保留）' : '授权码'
          }
          value={data.password}
          type="password"
          placeholder={data.passwordConfigured ? '******' : '请输入授权码'}
          required={!data.passwordConfigured}
          onChange={(v: string) => set('password', v)}
        />
        <div className="field-grid">
          <Field
            label="发件邮箱"
            type="email"
            value={data.sender}
            required
            onChange={(v: string) => set('sender', v)}
          />
          <Field
            label="发件人名称"
            value={data.senderName}
            onChange={(v: string) => set('senderName', v)}
          />
        </div>
        <Choice
          label="邮件服务"
          value={data.enabled ? 'yes' : 'no'}
          onChange={(v: string) => set('enabled', v === 'yes')}
          items={[
            ['no', '关闭'],
            ['yes', '启用'],
          ]}
        />
        <AdminFormActions busy={busy} showCancel={false}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
          保存邮件配置
        </button></AdminFormActions>
      </form>
      <form
        style={{ marginTop: 24 }}
        onSubmit={(e) => {
          e.preventDefault();
          void action('test-smtp', { to });
        }}
      >
        <Field
          label="测试收件邮箱"
          type="email"
          value={to}
          required
          onChange={setTo}
        />
        <button aria-busy={Boolean(busy)} className="btn" disabled={busy}>
          发送测试邮件
        </button>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
