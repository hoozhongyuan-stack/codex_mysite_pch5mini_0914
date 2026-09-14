'use client';
import { selectedAssetId } from '@/lib/workspace-route.mjs';
import { useState } from 'react';
import AssetPicker from './asset-picker';
import { mutate } from './shared';
export default function BrandSettings({ data, reload, onDirty }: any) {
  const [brand, setBrand] = useState(
      data.settings.brand || { logoId: '', faviconId: '', showName: false },
    ),
    [picker, setPicker] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function save(e: any) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('saveBrand', { data: brand });
      await reload();
      setMessage('品牌与图标已保存');
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel settings-panel brand-settings" onSubmit={save}>
      <h2>品牌与图标</h2>
      <p className="muted">
        顶部 Logo 建议使用透明 PNG / WebP，比例约 4:1；浏览器图标请使用正方形
        PNG，建议 512×512。
      </p>
      <div className="field-grid">
        {[
          ['logoId', '品牌 Logo'],
          ['faviconId', '浏览器图标'],
        ].map(([key, label]) => (
          <section className="brand-upload" key={key}>
            <h3>{label}</h3>
            <div
              className={
                'brand-image-preview ' +
                (key === 'faviconId' ? 'favicon-preview' : '')
              }
            >
              {brand[key] ? (
                <img src={'/api/media/' + brand[key]} alt={label} />
              ) : (
                <span className="muted">未设置</span>
              )}
            </div>
            <div className="flex-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setPicker(key)}
              >
                选择 / 上传图片
              </button>
              {brand[key] && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    onDirty?.();
                    setBrand({ ...brand, [key]: '' });
                  }}
                >
                  移除
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <label className="flex-actions">
        <input
          type="checkbox"
          checked={brand.showName}
          onChange={(e) => {
            onDirty?.();
            setBrand({ ...brand, showName: e.target.checked });
          }}
        />
        Logo 旁同时显示网站名称
      </label>
      <div className="brand-live-preview">
        <small>顶部导航预览</small>
        <div>
          {brand.logoId && <img src={'/api/media/' + brand.logoId} alt="" />}
          {(!brand.logoId || brand.showName) && (
            <strong>{data.settings.nameZh}</strong>
          )}
        </div>
        <small>浏览器标签预览</small>
        <div className="browser-tab-preview">
          {brand.faviconId && (
            <img src={'/api/media/' + brand.faviconId} alt="" />
          )}
          {data.settings.nameZh} <span>×</span>
        </div>
      </div>
      <div className="settings-save">
        <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
          {busy ? '保存中…' : '保存配置'}
        </button>
        <span role="status">{message}</span>
      </div>
      {picker && (
        <AssetPicker
          accept="image"
          onClose={() => setPicker('')}
          initialIds={brand[picker] ? [brand[picker]] : []}
          onSelect={(asset: any) => {
            onDirty?.();
            setBrand({ ...brand, [picker]: selectedAssetId(asset) });
            setPicker('');
          }}
        />
      )}
    </form>
  );
}
