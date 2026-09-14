'use client';
import { useEffect, useState } from 'react';
import { ordersApi } from '../order-shared';
import { Field, Choice } from './shared';
import { priceMinor, currencies } from '@/lib/product-options.mjs';
import AssetPicker from './asset-picker';
export default function OrderSettings() {
  const [config, setConfig] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState(-1);
  useEffect(() => {
    ordersApi('admin-settings')
      .then(setConfig)
      .catch((e) => setError(e.message));
  }, []);
  if (!config) return <p role="alert" className="error">{error || '正在读取配置…'}</p>;
  const set = (k: string, v: any) => setConfig({ ...config, [k]: v }),
    method = (i: number, k: string, v: any) =>
      set(
        'methods',
        config.methods.map((m: any, n: number) =>
          n === i ? { ...m, [k]: v } : m,
        ),
      );
  return (
    <form
      className="panel"
      style={{ padding: 24 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await ordersApi('admin-settings', config, true);
          setError('配置已保存');
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>交易设置</h2>
      <div className="notice" role="status">
        <b>{config.enabled ? '交易已启用' : '交易未启用：前台暂不能下单'}</b>
        <p>启用步骤：① 添加并启用收款项目；② 设置运费和售后期限；③ 勾选交易开关并保存；④ 为已发布商品设置价格与库存。</p>
        <p>关闭交易后，购物车与历史订单入口仍保留；用户不能提交新订单。</p>
      </div>
      {error && <p role="status">{error}</p>}
      <section className="panel" style={{padding:16,marginBottom:20}}><h3>小程序支付</h3><label><input type="checkbox" checked={config.miniPayments?.offline===true} onChange={e=>set('miniPayments',{...config.miniPayments,offline:e.target.checked})}/> 启用小程序线下付款</label><p className="muted">使用下方收款项目，与网站交易开关独立；关闭后不影响已提交凭证的后台审核。积分兑换独立运行。</p><label><input type="checkbox" checked={false} disabled/> 微信支付（待支付通知、退款与对账接入完成）</label></section>
      <label>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
        />
        启用实物商品交易
      </label>
      <p className="muted">
        启用前请设置售后期限及真实收款信息。库存未设置、面议商品不允许下单。
      </p>
      <div className="field-grid">
        <Field
          label="未付款关闭时限（小时）"
          type="number"
          required
          value={config.timeoutHours}
          onChange={(v: string) => set('timeoutHours', Number(v))}
        />
        <Field
          label="签收后售后期限（天；0表示签收后不可申请）"
          type="number"
          required={config.enabled}
          value={config.afterSaleDays ?? ''}
          onChange={(v: string) =>
            set('afterSaleDays', v === '' ? null : Number(v))
          }
        />
      </div>
      <h3>每单固定运费</h3>
      <div className="field-grid">
        {currencies.map((c) => (
          <label className="field" key={c}>
            {c}
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={config.shipping[c] / 100}
              onChange={(e) => {
                try {
                  set('shipping', {
                    ...config.shipping,
                    [c]: priceMinor(e.target.value) ?? 0,
                  });
                } catch {}
              }}
            />
          </label>
        ))}
      </div>
      <h3>线下收款项目</h3><p role="status" className="notice">当前有 {config.affectedPending||0} 个待付款订单。停用收款方式前请核对受影响订单并联系用户。</p>
      {config.methods.map((m: any, i: number) => (
        <section
          className="panel"
          key={m.id}
          style={{ padding: 20, marginTop: 12 }}
        >
          <div className="field-grid">
            <Field
              label="中文名称"
              required
              value={m.nameZh}
              onChange={(v: string) => method(i, 'nameZh', v)}
            />
            <Field
              label="英文名称"
              required
              value={m.nameEn}
              onChange={(v: string) => method(i, 'nameEn', v)}
            />
            <Field
              label="中文收款说明 / 账号信息"
              multiline
              value={m.instructionsZh}
              onChange={(v: string) => method(i, 'instructionsZh', v)}
            />
            <Field
              label="英文收款说明 / 账号信息"
              multiline
              value={m.instructionsEn}
              onChange={(v: string) => method(i, 'instructionsEn', v)}
            />
          </div>
          <label>
            <input
              type="checkbox"
              checked={m.enabled}
              onChange={(e) => method(i, 'enabled', e.target.checked)}
            />
            启用
          </label>
          <button type="button" className="btn" onClick={() => setPicker(i)}>
            选择收款图片
          </button>
          {m.imageId && (
            <img
              src={'/api/media/' + m.imageId}
              alt="收款图片"
              style={{ width: 120 }}
            />
          )}
          <button
            type="button"
            className="btn"
            onClick={() => method(i, 'imageId', '')}
          >
            清除图片
          </button>
          <button
            type="button"
            className="btn"
            disabled={i === 0}
            onClick={() => {
              const next = [...config.methods];
              [next[i - 1], next[i]] = [next[i], next[i - 1]];
              set('methods', next);
            }}
          >
            上移
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              set(
                'methods',
                config.methods.filter((_: any, n: number) => n !== i),
              )
            }
          >
            移除项目
          </button>
        </section>
      ))}
      <button
        type="button"
        className="btn"
        disabled={config.methods.length >= 20}
        onClick={() =>
          set('methods', [
            ...config.methods,
            {
              id: crypto.randomUUID(),
              nameZh: '',
              nameEn: '',
              instructionsZh: '',
              instructionsEn: '',
              imageId: '',
              enabled: true,
            },
          ])
        }
      >
        ＋ 新增收款项目
      </button>
      <p role="status" className="notice">
        停用项目后，对应待付款订单不能继续提交该方式的凭证；历史付款指引保留。
      </p>
      <p className="muted">操作权限统一在“权限组设置”中管理。</p>
      <button aria-busy={Boolean(busy)} className="btn primary" style={{ marginTop: 24 }} disabled={busy}>
        保存交易配置
      </button>
      {picker >= 0 && (
        <AssetPicker
          accept="image"
          onClose={() => setPicker(-1)}
          onSelect={(a: any) => {
            method(picker, 'imageId', a.id);
            setPicker(-1);
          }}
        />
      )}
    </form>
  );
}
