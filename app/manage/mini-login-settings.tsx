'use client';
import { useEffect, useState } from 'react';
import { Field } from './shared';
export default function MiniLoginSettings() {
  const [config, setConfig] = useState<any>(null),
    [secret, setSecret] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/identity-admin/mini')
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        setConfig(d);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  if (!config) return <p>{message || '读取登录配置…'}</p>;
  return (
    <section className="panel" style={{ padding: 20, marginTop: 24 }}>
      <h3>微信小程序登录</h3>
      <p className="muted">
        小程序 AppSecret 与网站微信登录独立配置，加密保存。更换 AppID
        时需要重新填写密钥。
      </p>
      <div className="field-grid">
        <Field
          label="登录 AppID（需与小程序工程一致）"
          value={config.clientId}
          onChange={(v: string) => setConfig({ ...config, clientId: v })}
        />
        <label className="field">
          <span>
            AppSecret {config.hasSecret ? '（已配置，留空保留）' : ''}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={config.hasSecret ? '******' : '请输入 AppSecret'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </label>
      </div>
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />{' '}
        启用微信小程序登录
      </label>
      <div className="flex-actions">
        <button aria-busy={Boolean(busy)}
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage('');
            try {
              const r = await fetch('/api/identity-admin/mini-save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...config, secret }),
              });
              const d: any = await r.json();
              if (!r.ok) throw Error(d.error);
              setConfig(d);
              setSecret('');
              setMessage('登录配置已保存');
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          保存登录配置
        </button>
        <span role="status">{message}</span>
      </div>
    </section>
  );
}
