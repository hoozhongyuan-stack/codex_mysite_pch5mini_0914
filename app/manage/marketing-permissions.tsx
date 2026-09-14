'use client';
import { useState } from 'react';
import { marketingApi } from './marketing-shared';
export default function MarketingPermissions() {
  const [open, setOpen] = useState(false),
    [rows, setRows] = useState<any[]>([]),
    [email, setEmail] = useState(''),
    [perms, setPerms] = useState<string[]>(['view']),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = async () => setRows((await marketingApi('admin-grants')).rows);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await marketingApi(
        'admin-save-grant',
        { email, permissions: perms },
        true,
      );
      await load();
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section style={{ margin: '16px 0' }}>
      <button
        className="btn"
        onClick={() => {
          setOpen(!open);
          load().catch((e) => setError(e.message));
        }}
      >
        营销权限配置
      </button>
      {open && (
        <div className="panel" style={{ padding: 24 }}>
          <p>
            先在“管理员”中添加子账号，再为该邮箱配置营销权限。主管理员保留全部权限。取消全部勾选即可撤销授权。
          </p>
          {error && <p role="alert" className="error">{error}</p>}
          <form onSubmit={save}>
            <label className="field">
              子账号邮箱
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div className="flex-actions">
              {[
                ['view', '查看活动与名单'],
                ['manage', '管理活动与报名'],
                ['checkin', '补签与撤销签到'],
                ['export', '导出名单'],
              ].map(([p, l]) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    checked={perms.includes(p)}
                    onChange={(e) =>
                      setPerms(
                        e.target.checked
                          ? [...perms, p]
                          : perms.filter((x) => x !== p),
                      )
                    }
                  />
                  {l}
                </label>
              ))}
              <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
                保存权限
              </button>
            </div>
          </form>
          {rows.map((r) => (
            <p key={r.email}>
              {r.email} · {r.permissions.join(' / ') || '未授权'}{' '}
              <button
                className="btn"
                onClick={() => {
                  setEmail(r.email);
                  setPerms(r.permissions);
                }}
              >
                编辑
              </button>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
