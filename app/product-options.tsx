'use client';
import PurchaseButtons from './purchase-buttons';
import { combinations, priceLabel } from '@/lib/product-options.mjs';
import { useProductSelection } from './product-context';
export { ProductProvider, useProductSelection } from './product-context';
export default function ProductOptions({ en }: { en: boolean }) {
  const p = useProductSelection();
  if (!p) return null;
  const { trade: t, selection, setSelection, valid, key } = p,
    rows = combinations(t.specs),
    enabled = rows.filter((r: any) =>
      t.variants.some((v: any) => v.key === r.key && v.enabled),
    );
  return (
    <section
      className="product-purchase-options"
      aria-label={en ? 'Product options' : '商品规格与价格'}
    >
      <div className="product-price" aria-live="polite">
        {priceLabel(t, valid ? key : '', en)}
        <small>{t.currency}</small>
      </div>
      {t.specs.map((spec: any, i: number) => (
        <fieldset key={spec.id}>
          <legend>{en ? spec.nameEn : spec.nameZh}</legend>
          <div className="option-values">
            {spec.values.map((v: any) => {
              const available = enabled.some(
                (r: any) =>
                  r.ids[i] === v.id &&
                  selection.every((s, j) => j === i || !s || r.ids[j] === s),
              );
              return (
                <button
                  type="button"
                  key={v.id}
                  disabled={!available}
                  aria-pressed={selection[i] === v.id}
                  onClick={() =>
                    setSelection(selection.map((s, j) => (j === i ? v.id : s)))
                  }
                >
                  {en ? v.nameEn : v.nameZh}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {!!t.specs.length && (
        <div className="option-selection-note">
          <span>
            {valid
              ? en
                ? 'Options selected'
                : '已选择完整规格'
              : en
                ? 'Select all options to view the price.'
                : '请选择完整规格，查看对应价格。'}
          </span>
          <button
            type="button"
            onClick={() => setSelection(t.specs.map(() => ''))}
          >
            {en ? 'Clear selection' : '重选规格'}
          </button>
        </div>
      )}
      {t.stockStatus && (
        <p
          className={'product-stock ' + (t.stockStatus === 'out' ? 'out' : '')}
          aria-live="polite"
        >
          {t.stockStatus === 'out'
            ? en
              ? 'Currently out of stock · Inquiries welcome'
              : '暂时缺货 · 仍可咨询'
            : t.inventoryDisplay === 'quantity'
              ? en
                ? `${t.inventory} in stock`
                : `库存 ${t.inventory} 件`
              : en
                ? 'In stock'
                : '有库存'}
        </p>
      )}
      <PurchaseButtons en={en}/>
    </section>
  );
}
