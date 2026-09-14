'use client';
import { useState, useEffect, useRef } from 'react';
import { Field, Choice } from './shared';
import {
  combinations,
  reconcileVariants,
  validateTrade,
  priceMinor,
  currencies,
} from '@/lib/product-options.mjs';
function Amount({ value, onChange, label }: any) {
  const [draft, setDraft] = useState(
      value === null ? '' : (value / 100).toFixed(2),
    ),
    [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      if (priceMinor(draft) === value) return;
    } catch {}
    setDraft(value === null ? '' : (value / 100).toFixed(2));
    setError('');
    ref.current?.setCustomValidity('');
  }, [value]);
  return (
    <label className="amount-field">
      <span className="sr-only">{label}</span>
      <input
        ref={ref}
        aria-label={label}
        type="text"
        inputMode="decimal"
        maxLength={11}
        placeholder="留空：面议"
        value={draft}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          try {
            const amount = priceMinor(raw);
            setError('');
            e.target.setCustomValidity('');
            onChange(amount);
          } catch (err) {
            const message = (err as Error).message;
            setError(message);
            e.target.setCustomValidity(message);
          }
        }}
      />
      {error && <small className="error">{error}</small>}
    </label>
  );
}
export default function ProductOptionsEditor({
  value,
  onChange,
  published,
}: any) {
  const t = value || validateTrade(),
    [error, setError] = useState(''),
    [bulk, setBulk] = useState('');
  const set = (k: string, v: any) => onChange({ ...t, [k]: v });
  function changeSpecs(specs: any[]) {
    try {
      const variants = reconcileVariants(specs, t.variants);
      const lost = t.variants.filter(
        (v: any) =>
          v.priceMinor !== null && !variants.some((n: any) => n.key === v.key),
      );
      if (
        lost.length &&
        !window.confirm(
          `规格调整将移除 ${lost.length} 个已定价组合。继续后，新组合需要重新定价，是否继续？`,
        )
      )
        return;
      onChange({ ...t, specs, variants });
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const changeSpec = (i: number, k: string, v: any) =>
    changeSpecs(
      t.specs.map((s: any, n: number) => (n === i ? { ...s, [k]: v } : s)),
    );
  const changeValue = (i: number, j: number, k: string, v: any) =>
    changeSpec(
      i,
      'values',
      t.specs[i].values.map((r: any, n: number) =>
        n === j ? { ...r, [k]: v } : r,
      ),
    );
  const swap = (rows: any[], i: number) =>
    rows.map((v, n) => (n === i ? rows[i - 1] : n === i - 1 ? rows[i] : v));
  const rows = combinations(t.specs);
  function setVariant(key: string, patch: any) {
    set(
      'variants',
      t.variants.map((v: any) => (v.key === key ? { ...v, ...patch } : v)),
    );
  }
  return (
    <fieldset className="product-options-editor">
      <legend>商品规格、价格与库存</legend>
      <p className="muted">
        库存发布时必填，售罄填0；多规格逐项填写，自动汇总。草稿可暂不填写。
      </p>
      <div className="field-grid">
        <label className="field"><span>每件商品完成订单赠送积分</span><input type="number" min={0} max={1000000} step={1} value={t.rewardPoints ?? 0} onChange={e => set('rewardPoints', Number(e.target.value))}/><small>所有规格一致，按购买数量累计；0表示不赠分。</small></label>
        <Choice
          label="商品币种"
          value={t.currency}
          items={currencies.map((c) => [
            c,
            (
              {
                CNY: '人民币',
                USD: '美元',
                EUR: '欧元',
                GBP: '英镑',
                HKD: '港币',
              } as any
            )[c] +
              ' · ' +
              c,
          ])}
          onChange={(v: string) => set('currency', v)}
        />
        <label className="field">
          <span>{t.specs.length ? '商品总库存（自动汇总）' : '商品库存 *'}</span>
          <input
            type="number"
            min={0}
            max={999999999}
            step={1}
            disabled={!!t.specs.length}
            value={t.specs.length ? (t.variants.filter((v:any)=>v.enabled).some((v:any)=>v.inventory == null) ? '' : t.variants.filter((v:any)=>v.enabled).reduce((n:number,v:any)=>n+v.inventory,0)) : t.inventory ?? ''}
            onChange={(e) =>
              set(
                'inventory',
                e.target.value === '' ? null : Number(e.target.value),
              )
            }
          />
        </label>
        <Choice
          label="前台库存展示"
          value={t.inventoryDisplay}
          onChange={(v: string) => set('inventoryDisplay', v)}
          items={[
            ['hidden', '隐藏库存'],
            ['status', '仅显示库存状态'],
            ['quantity', '显示具体数量'],
          ]}
        />
      </div>
      <div className="section-head">
        <h3>自定义规格（{t.specs.length}/3）</h3>
        <button
          type="button"
          className="btn"
          disabled={t.specs.length >= 3}
          onClick={() =>
            changeSpecs([
              ...t.specs,
              {
                id: crypto.randomUUID(),
                nameZh: '',
                nameEn: '',
                values: [{ id: crypto.randomUUID(), nameZh: '', nameEn: '' }],
              },
            ])
          }
        >
          ＋ 添加规格项
        </button>
      </div>
      {t.specs.map((s: any, i: number) => (
        <section className="spec-editor-card" key={s.id}>
          <div className="spec-row">
            <b>规格 {i + 1}</b>
            <button
              type="button"
              className="btn"
              disabled={!i}
              onClick={() => changeSpecs(swap(t.specs, i))}
            >
              上移
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                changeSpecs(t.specs.filter((_: any, n: number) => n !== i))
              }
            >
              删除规格项
            </button>
          </div>
          <div className="field-grid">
            <Field
              label="规格名称（中文）"
              required
              value={s.nameZh}
              maxLength={40}
              onChange={(v: string) => changeSpec(i, 'nameZh', v)}
            />
            <Field
              label="规格名称（英文，发布必填）"
              required={published}
              value={s.nameEn}
              maxLength={60}
              onChange={(v: string) => changeSpec(i, 'nameEn', v)}
            />
          </div>
          {s.values.map((v: any, j: number) => (
            <div className="spec-value-row" key={v.id}>
              <Field
                label={'规格值 ' + (j + 1) + '（中文）'}
                required
                value={v.nameZh}
                maxLength={40}
                onChange={(x: string) => changeValue(i, j, 'nameZh', x)}
              />
              <Field
                label="英文规格值"
                required={published}
                value={v.nameEn}
                maxLength={60}
                onChange={(x: string) => changeValue(i, j, 'nameEn', x)}
              />
              <button
                type="button"
                className="btn"
                disabled={!j}
                onClick={() => changeSpec(i, 'values', swap(s.values, j))}
              >
                上移
              </button>
              <button
                type="button"
                className="btn"
                disabled={s.values.length === 1}
                onClick={() =>
                  changeSpec(
                    i,
                    'values',
                    s.values.filter((_: any, n: number) => j !== n),
                  )
                }
              >
                移除
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() =>
              changeSpec(i, 'values', [
                ...s.values,
                { id: crypto.randomUUID(), nameZh: '', nameEn: '' },
              ])
            }
          >
            ＋ 添加规格值
          </button>
        </section>
      ))}
      <h3>
        组合价格 · {t.currency}（{rows.length}/100）
      </h3>
      <div className="spec-row">
        <input
          aria-label="批量价格"
          placeholder="批量填写价格"
          type="number"
          min="0"
          step="0.01"
          max="99999999.99"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          onClick={() => {
            try {
              const amount = priceMinor(bulk);
              if (
                window.confirm(
                  `将所有 ${rows.length} 个组合设为${amount === null ? '面议' : bulk + ' ' + t.currency}，确认覆盖价格？`,
                )
              )
                set(
                  'variants',
                  t.variants.map((v: any) => ({ ...v, priceMinor: amount })),
                );
              setError('');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          应用到全部组合
        </button>
      </div>
      <div className="list-table-wrap">
        <table className="list-table">
          <thead>
            <tr>
              <th>规格组合</th>
              <th>价格（{t.currency}）</th>
              {t.specs.length > 0 && <th>库存 *</th>}<th>提供此组合</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => {
              const variant = t.variants.find((v: any) => v.key === row.key);
              return (
                <tr key={row.key}>
                  <td>
                    {row.ids
                      .map(
                        (id: string, i: number) =>
                          t.specs[i].values.find((v: any) => v.id === id)
                            ?.nameZh || '未命名',
                      )
                      .join(' / ') || '默认商品（无规格）'}
                  </td>
                  <td>
                    <Amount
                      label={'组合价格 ' + row.key}
                      value={variant.priceMinor}
                      onChange={(priceMinor: number | null) =>
                        setVariant(row.key, { priceMinor })
                      }
                    />
                  </td>
                  {t.specs.length > 0 && <td><input type="number" aria-label={'规格库存 '+row.key} min={0} max={999999999} step={1} value={variant.inventory ?? ''} placeholder="待填写" onChange={e=>setVariant(row.key,{inventory:e.target.value===''?null:Number(e.target.value)})}/></td>}
                  <td>
                    <input
                      type="checkbox"
                      aria-label={'启用组合 ' + row.key}
                      checked={variant.enabled}
                      onChange={(e) =>
                        setVariant(row.key, { enabled: e.target.checked })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">
        至少启用一个组合。价格为 0 表示展示 0 元，保存时会再次提示。
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
