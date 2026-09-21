'use client';
import { AdminFormActions } from './admin-dialog';
import SiteLink from '../../components/site-link';

import { useState } from 'react';
import { Field, Choice, mutate } from './shared';
import AssetPicker from './asset-picker';
import { Checkbox } from '@/components/ui/checkbox';
const platforms = [
  ['wechat', '微信'],
  ['linkedin', 'LinkedIn'],
  ['facebook', 'Facebook'],
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube'],
  ['x', 'X'],
  ['custom', '自定义'],
];
export default function FooterSettings({ data, reload, onDirty }: any) {
  const [form, setForm] = useState<any>(
    data.settings.footer || {
      navIds: data.navigation
        .filter((n: any) => n.enabled)
        .map((n: any) => n.id),
      policyKinds: ['terms', 'privacy', 'cookies'],
      socials: [],
      registrations: [],
      copyrightUrl: 'https://aition.art',
    },
  );
  const [picker, setPicker] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const set = (k: string, v: any) => {
    onDirty?.();
    setForm((f: any) => ({ ...f, [k]: v }));
  };
  const update = (k: string, i: number, key: string, value: any) =>
    set(
      k,
      form[k].map((r: any, n: number) =>
        n === i ? { ...r, [key]: value } : r,
      ),
    );
  const move = (k: string, i: number, delta: number) => {
    const j = i + delta;
    set(
      k,
      form[k].map((r: any, n: number) =>
        n === i ? form[k][j] : n === j ? form[k][i] : r,
      ),
    );
  };
  const controls = (k: string, i: number) => (
    <div className="flex-actions">
      <button
        className="btn"
        type="button"
        disabled={i === 0}
        onClick={() => move(k, i, -1)}
        aria-label="上移"
      >
        ↑
      </button>
      <button
        className="btn"
        type="button"
        disabled={i === form[k].length - 1}
        onClick={() => move(k, i, 1)}
        aria-label="下移"
      >
        ↓
      </button>
      <button
        className="btn"
        type="button"
        onClick={() =>
          set(
            k,
            form[k].filter((_: any, n: number) => n !== i),
          )
        }
      >
        移除
      </button>
    </div>
  );
  const bilingual = (key: string, label: string, multiline = false) => (
    <div className="field-grid">
      {['Zh', 'En'].map((lang) => (
        <Field
          key={lang}
          label={label + (lang === 'Zh' ? ' · 中文' : ' · English')}
          value={form[key + lang]}
          multiline={multiline}
          onChange={(v: string) => set(key + lang, v)}
        />
      ))}
    </div>
  );
  const imageName = (id: string) =>
    data.assets.find((a: any) => a.id === id)?.name || '尚未选择';
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await mutate('saveFooter', { data: form });
      await reload();
      setMessage('页脚设置已保存，前台立即生效。');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        id="footer-settings-form"
        className="panel settings-panel footer-settings"
        onSubmit={save}
      >
        <h2>页脚设置</h2>
        <p className="muted">
          公司、社交及备案信息留空则不展示。中英文分别配置，品牌信息留空时沿用网站设置。
        </p>
        <fieldset>
          <legend>品牌介绍</legend>
          <p role="status" className="notice">品牌名称自动同步基础信息中的网站名称。</p>
          {bilingual('description', '简短描述', true)}
          <div className="field">
            <span>品牌 Logo（留空使用默认标志）</span>
            <div className="flex-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setPicker(-1)}
              >
                从素材库选择
              </button>
              <span className="muted">{imageName(form.logoId)}</span>
              {form.logoId && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => set('logoId', '')}
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>公司与联系方式</legend>
          {bilingual('company', '公司名称')}
          {bilingual('address', '公司地址', true)}
          <div className="field-grid">
            <Field
              label="联系电话"
              type="tel"
              value={form.phone}
              onChange={(v: string) => set('phone', v)}
            />
            <Field
              label="联系邮箱（留空沿用公开联系邮箱）"
              type="email"
              value={form.email}
              onChange={(v: string) => set('email', v)}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>快捷导航</legend>
          <p className="muted">
            从导航管理中选择。关闭或目标未发布的导航不会出现在前台，最多 12 项。
          </p>
          {form.navIds.map((id: string, i: number) => (
            <div className="footer-config-row" key={id}>
              <span>
                {data.navigation.find((n: any) => n.id === id)?.labelZh ||
                  '导航已删除，请移除'}
              </span>
              {controls('navIds', i)}
            </div>
          ))}
          {form.navIds.length < 12 && (
            <Choice
              label="添加快捷导航"
              value=""
              onChange={(v: string) => v && set('navIds', [...form.navIds, v])}
              items={data.navigation
                .filter((n: any) => !form.navIds.includes(n.id))
                .map((n: any) => [
                  n.id,
                  n.labelZh + (n.enabled ? '' : '（已隐藏）'),
                ])}
            />
          )}
        </fieldset>
        <fieldset>
          <legend>社交方式</legend>
          <p className="muted">
            链接必须为 HTTPS。微信等二维码在点击后弹窗展示，最多 12 项。
          </p>
          {form.socials.map((s: any, i: number) => (
            <div className="footer-config-card" key={i}>
              <div className="heading-row">
                <b>社交方式 {i + 1}</b>
                {controls('socials', i)}
              </div>
              <div className="field-grid">
                <Choice
                  label="平台"
                  value={s.platform}
                  onChange={(v: string) => update('socials', i, 'platform', v)}
                  items={platforms}
                />
                <Choice
                  label="展示方式"
                  value={s.kind}
                  onChange={(v: string) => update('socials', i, 'kind', v)}
                  items={[
                    ['link', '跳转链接'],
                    ['qr', '二维码弹窗'],
                  ]}
                />
              </div>
              {s.platform === 'custom' && (
                <Choice
                  label="自定义图标"
                  value={s.icon || 'globe'}
                  onChange={(v: string) => update('socials', i, 'icon', v)}
                  items={[
                    ['globe', '网站'],
                    ['message', '消息'],
                    ['camera', '图片'],
                    ['video', '视频'],
                  ]}
                />
              )}
              <div className="field-grid">
                <Field
                  label="中文名称"
                  required
                  value={s.labelZh}
                  onChange={(v: string) => update('socials', i, 'labelZh', v)}
                />
                <Field
                  label="英文名称"
                  required
                  value={s.labelEn}
                  onChange={(v: string) => update('socials', i, 'labelEn', v)}
                />
              </div>
              {s.kind === 'link' ? (
                <Field
                  label="跳转链接（HTTPS）"
                  required
                  type="url"
                  value={s.url}
                  onChange={(v: string) => update('socials', i, 'url', v)}
                />
              ) : (
                <div className="field">
                  <span>
                    <b className="required-mark">*</b>二维码图片
                  </span>
                  <div className="flex-actions">
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setPicker(i)}
                    >
                      选择二维码
                    </button>
                    <span>{imageName(s.imageId)}</span>
                  </div>
                  {s.imageId && (
                    <img
                      className="footer-config-qr"
                      src={'/api/media/' + s.imageId}
                      alt="已选择的二维码"
                    />
                  )}
                </div>
              )}
              <label className="consent">
                <Checkbox
                  checked={s.enabled}
                  onCheckedChange={(v) =>
                    update('socials', i, 'enabled', v === true)
                  }
                />
                在前台显示
              </label>
            </div>
          ))}
          <button
            className="btn"
            type="button"
            disabled={form.socials.length >= 12}
            onClick={() =>
              set('socials', [
                ...form.socials,
                {
                  platform: 'wechat',
                  kind: 'qr',
                  labelZh: '微信',
                  labelEn: 'WeChat',
                  enabled: true,
                  imageId: '',
                  url: '',
                },
              ])
            }
          >
            ＋ 添加社交方式
          </button>
        </fieldset>
        <fieldset>
          <legend>版权信息</legend>
          {bilingual('copyright', '版权描述')}
          <div className="field-grid">
            <Field
              label="版权跳转链接（可选）"
              type="url"
              value={form.copyrightUrl}
              onChange={(v: string) => set('copyrightUrl', v)}
            />
            <Field
              label="年份（留空自动更新，如 2020–2026）"
              value={form.year}
              onChange={(v: string) => set('year', v)}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>备案信息</legend>
          <p className="muted">
            可分别填写 ICP 与公安备案信息，最多 4 项；按下列顺序展示。
          </p>
          {form.registrations.map((r: any, i: number) => (
            <div className="footer-config-card" key={i}>
              <div className="heading-row">
                <b>备案 {i + 1}</b>
                {controls('registrations', i)}
              </div>
              <Field
                label="备案号"
                required
                value={r.label}
                onChange={(v: string) => update('registrations', i, 'label', v)}
              />
              <Field
                label="备案信息网址（HTTPS）"
                required
                type="url"
                value={r.url}
                onChange={(v: string) => update('registrations', i, 'url', v)}
              />
            </div>
          ))}
          <button
            className="btn"
            type="button"
            disabled={form.registrations.length >= 4}
            onClick={() =>
              set('registrations', [
                ...form.registrations,
                { label: '', url: '' },
              ])
            }
          >
            ＋ 添加备案信息
          </button>
        </fieldset>
        <fieldset>
          <legend>协议与政策</legend>
          <p className="muted">
            仅展示已有发布版本的政策。移除可隐藏，内容请在“协议与政策”维护。Cookie
            偏好设置始终保留。
          </p>
          {form.policyKinds.map((kind: string, i: number) => (
            <div className="footer-config-row" key={kind}>
              <span>
                {
                  {
                    terms: '注册协议',
                    privacy: '隐私协议',
                    cookies: 'Cookie 政策',
                  }[kind as 'terms']
                }
              </span>
              {controls('policyKinds', i)}
            </div>
          ))}
          {form.policyKinds.length < 3 && (
            <Choice
              label="添加政策链接"
              value=""
              onChange={(v: string) =>
                v && set('policyKinds', [...form.policyKinds, v])
              }
              items={Object.entries({
                terms: '注册协议',
                privacy: '隐私协议',
                cookies: 'Cookie 政策',
              }).filter(([k]) => !form.policyKinds.includes(k))}
            />
          )}
        </fieldset>
        <section className="footer-live-preview">
          <h3>页脚内容预览</h3>
          <div className="field-grid">
            <div>
              {form.logoId && (
                <img src={'/api/media/' + form.logoId} alt="品牌预览" />
              )}
              <strong>{data.settings.nameZh}</strong>
              <p>{form.descriptionZh}</p>
            </div>
            <div>
              <strong>{form.companyZh}</strong>
              <p>{form.addressZh}</p>
              <p>
                {form.phone} {form.email}
              </p>
            </div>
          </div>
          <p>
            {form.socials.map((s: any) => s.labelZh || s.platform).join(' · ')}
          </p>
          <p>
            {form.policyKinds
              .map(
                (k: string) =>
                  (
                    ({
                      terms: '注册协议',
                      privacy: '隐私协议',
                      cookies: 'Cookie 政策',
                    }) as any
                  )[k],
              )
              .join('　|　')}
          </p>
          <small>
            {form.copyrightZh}{' '}
            {form.registrations.map((r: any) => r.label).join('　')}
          </small>
        </section>
        <AdminFormActions busy={busy} showCancel={false}>
          <button aria-busy={Boolean(busy)} type="submit" className="btn primary" disabled={busy}>
            {busy ? '保存中…' : '保存配置'}
          </button>
          <SiteLink className="btn" href="/zh" target="_blank" rel="noreferrer">
            预览前台 ↗
          </SiteLink>
        </AdminFormActions>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </form>
      {picker !== null && (
        <AssetPicker
          accept="image"
          assets={data.assets.filter((a: any) => a.mime.startsWith('image/'))}
          folders={data.folders}
          onClose={() => setPicker(null)}
          onSelect={(a: any) => {
            if (picker === -1) set('logoId', a.id);
            else update('socials', picker, 'imageId', a.id);
            setPicker(null);
          }}
        />
      )}
    </>
  );
}
