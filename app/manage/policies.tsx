'use client';
import { AdminFormActions } from './admin-dialog';
import { AdminTabs } from './admin-ui';
import { useAdminUnsavedChanges } from './admin-navigation';
import { useState } from 'react';
import { Field, Choice, mutate } from './shared';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
const labels: any = {
  terms: '用户注册协议',
  privacy: '隐私协议',
  cookies: 'Cookie 政策',
};
export default function PolicyManager({ data, reload }: any) {
  const [kind, setKind] = useState('terms'),
    [edit, setEdit] = useState<any>(
      data.policies.find((p: any) => p.kind === 'terms') || {
        kind: 'terms',
        titleZh: labels.terms,
        titleEn: 'Terms of Registration',
        status: 'draft',
      },
    ),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [dirty,setDirty]=useState(false);
  useAdminUnsavedChanges(dirty);
  function choose(k: string) {
    if(k===kind)return;
    if(dirty&&!confirm('有未保存的修改，确定切换？'))return;
    setDirty(false);
    setKind(k);
    setEdit(
      data.policies.find((p: any) => p.kind === k) || {
        kind: k,
        titleZh: labels[k],
        titleEn: {
          terms: 'Terms of Registration',
          privacy: 'Privacy Policy',
          cookies: 'Cookie Policy',
        }[k],
        status: 'draft',
      },
    );
    setMessage('');
  }
  const set = (k: string, v: string) => {setDirty(true);setEdit((s: any) => ({ ...s, [k]: v }));};
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('savePolicy', { data: edit });
      await reload();
      setDirty(false);
      setMessage(
        edit.status === 'published'
          ? '政策已发布，版本号已更新。'
          : '草稿已保存，原已发布版本保持可用。',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="heading-row">
        <div>
          <h1>协议与政策</h1>
          <p className="muted">
            配置网站实际使用的协议文本。草稿不会覆盖已发布版本。
          </p>
        </div>
      </div>
      <AdminTabs label="协议类型" value={kind} items={Object.entries(labels).map(([k,l])=>[k,String(l)])} onChange={choose}/>
      <form
        className="panel settings-panel"
        style={{ marginTop: 20 }}
        onSubmit={save}
      >
        <div className="field-grid">
          <Field
            label="中文标题"
            value={edit.titleZh}
            onChange={(v: string) => set('titleZh', v)}
            required
          />
          <Field
            label="英文标题"
            value={edit.titleEn}
            onChange={(v: string) => set('titleEn', v)}
            required
          />
        </div>
        <Field
          label="中文政策正文"
          value={edit.bodyZh}
          onChange={(v: string) => set('bodyZh', v)}
          multiline
        />
        <Field
          label="英文政策正文"
          value={edit.bodyEn}
          onChange={(v: string) => set('bodyEn', v)}
          multiline
        />
        <Choice
          label="保存方式"
          value={edit.status}
          onChange={(v: string) => set('status', v)}
          items={[
            ['draft', '保存为草稿'],
            ['published', '发布新版本'],
          ]}
        />
        <p className="muted">
          当前发布版本：
          {data.policies.find((p: any) => p.kind === kind)?.version || 0}
        </p>
        <AdminFormActions showCancel={false} busy={busy}>
        <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
          {busy ? '保存中…' : '保存政策'}
        </button>
        </AdminFormActions>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </form>
    </>
  );
}
