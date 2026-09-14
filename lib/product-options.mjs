const moneyMax = 9999999999;
export const currencies = ['CNY', 'USD', 'EUR', 'GBP', 'HKD'];
const string = (v, max, required = false) => {
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim()))
    throw Error('规格名称不能为空或超过长度限制');
  return v.trim();
};
const id = (v) => {
  if (typeof v !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(v))
    throw Error('规格标识无效');
  return v;
};
export function priceMinor(value) {
  if (value === '' || value === null || value === undefined) return null;
  const s = String(value);
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s))
    throw Error('价格须为非负金额，最多8位整数、2位小数');
  const [whole, fraction = ''] = s.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (n > moneyMax) throw Error('价格过大');
  return n;
}
export function combinations(specs) {
  if (!Array.isArray(specs) || specs.length > 3) throw Error('最多3个规格项');
  let rows = [{ key: 'default', ids: [] }];
  for (const spec of specs) {
    if (!Array.isArray(spec.values) || !spec.values.length)
      throw Error('每个规格项至少包含1个规格值');
    if (rows.length * spec.values.length > 100)
      throw Error('规格组合最多100个');
    rows = rows.flatMap((r) =>
      spec.values.map((v) => {
        const ids = [...r.ids, v.id];
        return { key: [...ids].sort().join('~'), ids };
      }),
    );
  }
  return rows;
}
export function validateTrade(input, required = false) {
  if ((input === undefined || input === null) && required) throw Error('请填写商品库存');
  if (input === undefined || input === null)
    return {
      specs: [],
      currency: 'CNY',
      rewardPoints: 0,
      inventory: null,
      inventoryDisplay: 'hidden',
      variants: [{ key: 'default', priceMinor: null, enabled: true }],
    };
  if (typeof input !== 'object' || Array.isArray(input))
    throw Error('商品规格配置无效');
  if (!Array.isArray(input.specs) || input.specs.length > 3)
    throw Error('最多3个规格项');
  const used = new Set();
  const unique = (value) => {
    const key = id(value);
    if (used.has(key)) throw Error('规格标识重复');
    used.add(key);
    return key;
  };
  const specs = input.specs.map((s) => {
    const specId = unique(s.id);
    if (!Array.isArray(s.values) || !s.values.length || s.values.length > 100)
      throw Error('每个规格项需1–100个规格值');
    const names = new Set();
    return {
      id: specId,
      nameZh: string(s.nameZh, 40, true),
      nameEn: string(s.nameEn || '', 60, required),
      values: s.values.map((v) => {
        const nameZh = string(v.nameZh, 40, true);
        if (names.has(nameZh.toLowerCase()))
          throw Error('同一规格项不能有重复规格值');
        names.add(nameZh.toLowerCase());
        return {
          id: unique(v.id),
          nameZh,
          nameEn: string(v.nameEn || '', 60, required),
        };
      }),
    };
  });
  if (new Set(specs.map((s) => s.nameZh.toLowerCase())).size !== specs.length)
    throw Error('规格项名称不能重复');
  const rows = combinations(specs);
  if (!currencies.includes(input.currency)) throw Error('请选择支持的币种');
  if (
    input.inventory !== null &&
    (!Number.isSafeInteger(input.inventory) ||
      input.inventory < 0 ||
      input.inventory > 999999999)
  )
    throw Error('库存须为空或0–999999999的整数');
  if (!['hidden', 'status', 'quantity'].includes(input.inventoryDisplay))
    throw Error('库存展示方式无效');
  if (!Array.isArray(input.variants) || input.variants.length !== rows.length)
    throw Error('规格组合已变化，请检查组合价格');
  const keys = new Set();
  const variants = input.variants.map((v) => {
    if (keys.has(v.key) || !rows.some((r) => r.key === v.key))
      throw Error('规格组合不匹配');
    keys.add(v.key);
    if (
      v.priceMinor !== null &&
      (!Number.isSafeInteger(v.priceMinor) ||
        v.priceMinor < 0 ||
        v.priceMinor > moneyMax)
    )
      throw Error('组合价格无效');
    if (typeof v.enabled !== 'boolean') throw Error('组合状态无效');
    const pointsPrice = v.pointsPrice ?? null;
    if (pointsPrice !== null && (!Number.isSafeInteger(pointsPrice) || pointsPrice < 1 || pointsPrice > 1000000)) throw Error('兑换积分须为1至1000000的整数或留空');
    const inventory = v.inventory ?? null;
    if (inventory !== null && (!Number.isSafeInteger(inventory) || inventory < 0 || inventory > 999999999)) throw Error('规格库存须为0–999999999的整数');
    if (required && specs.length && v.enabled && inventory === null) {
      const name=specs.flatMap(s=>s.values.filter(x=>v.key.split('~').includes(x.id)).map(x=>x.nameZh)).join(' / ');
      throw Error('请填写规格「'+name+'」的库存（售罄请填0）');
    }
    return { key: v.key, priceMinor: v.priceMinor, enabled: v.enabled, pointsPrice, inventory };
  });
  if (!variants.some((v) => v.enabled))
    throw Error('至少保留一个可咨询的规格组合');
  if (required && !specs.length && input.inventory == null) throw Error('请填写商品库存（售罄请填0）');
  const variantStock = specs.length > 0 && (required || input.inventoryMode === 'variants' || variants.some(v=>v.inventory !== null));
  const enabledStock=variants.filter(v=>v.enabled);
  const inventory=variantStock ? (enabledStock.some(v=>v.inventory===null) ? null : enabledStock.reduce((sum,v)=>sum+v.inventory,0)) : input.inventory;
  if (inventory > 999999999) throw Error('商品库存总数超过999999999');
  const rewardPoints = input.rewardPoints ?? 0;
  if (!Number.isSafeInteger(rewardPoints) || rewardPoints < 0 || rewardPoints > 1000000) throw Error('购买赠分须为0至1000000的整数');
  const counts = {};
  for (const key of ['redemptionQuota','redemptionLimit','redemptionSort']) {
    const value = input[key] ?? 0;
    if (!Number.isSafeInteger(value) || value < 0 || value > 999999999) throw Error('兑换配额、限兑数及排序须为0至999999999的整数');
    counts[key] = value;
  }
  return {
    ...counts,
    redemptionListed: input.redemptionListed === undefined ? input.redemptionEnabled === true : input.redemptionListed === true,
    redemptionEnabled: input.redemptionEnabled === true,
    rewardPoints,
    specs,
    currency: input.currency,
    inventory,
    inventoryMode: variantStock ? 'variants' : 'shared',
    inventoryDisplay: input.inventoryDisplay,
    variants,
  };
}
export function reconcileVariants(specs, variants) {
  return combinations(specs).map(
    (r) =>
      variants.find((v) => v.key === r.key) || {
        key: r.key,
        priceMinor: null,
        enabled: true,
      },
  );
}
export function publicTrade(input) {
  const t = validateTrade(input);
  return {
    ...t,
    inventory: t.inventoryDisplay === 'quantity' ? t.inventory : null,
    variants: t.variants.map(v=>({...v,inventory:t.inventoryDisplay==='quantity'?v.inventory:null})),
    stockStatus:
      t.inventoryDisplay === 'hidden'
        ? null
        : t.inventory === null
          ? input?.stockStatus === 'out' || input?.stockStatus === 'in'
            ? input.stockStatus
            : null
          : t.inventory === 0
            ? 'out'
            : 'in',
  };
}
export function formatMoney(minor, currency, en = false) {
  return minor === null
    ? en
      ? 'Price on request'
      : '价格面议'
    : new Intl.NumberFormat(en ? 'en-US' : 'zh-CN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(minor / 100);
}
export function priceLabel(trade, key, en = false) {
  const row = trade.variants.find((v) => v.key === key && v.enabled);
  if (row) return formatMoney(row.priceMinor, trade.currency, en);
  const enabled = trade.variants.filter((v) => v.enabled),
    priced = enabled
      .filter((v) => v.priceMinor !== null)
      .map((v) => v.priceMinor);
  if (!priced.length) return en ? 'Price on request' : '价格面议';
  const lo = Math.min(...priced),
    hi = Math.max(...priced);
  return (
    formatMoney(lo, trade.currency, en) +
    (hi !== lo ? ' – ' + formatMoney(hi, trade.currency, en) : '') +
    (priced.length < enabled.length
      ? en
        ? ' · Some options on request'
        : ' · 部分规格面议'
      : '')
  );
}
export function inquirySnapshot(product, input) {
  const t = validateTrade(product.trade);
  if (input?.version !== product.updatedAt)
    throw Error('商品规格、价格或库存已更新，请刷新页面后重新选择');
  if (
    !Array.isArray(input.selection) ||
    input.selection.length !== t.specs.length
  )
    throw Error('请选择完整的商品规格');
  for (let i = 0; i < t.specs.length; i++)
    if (!t.specs[i].values.some((v) => v.id === input.selection[i]))
      throw Error('规格选择无效');
  const key = input.selection.length
      ? [...input.selection].sort().join('~')
      : 'default',
    variant = t.variants.find((v) => v.key === key && v.enabled);
  if (!variant) throw Error('当前规格组合不可咨询，请重新选择');
  const displayed = publicTrade(t);
  return {
    spu: product.spu || '',
    currency: t.currency,
    priceMinor: variant.priceMinor,
    inventory: displayed.inventory,
    stockStatus: displayed.stockStatus,
    inventoryDisplay: t.inventoryDisplay,
    version: product.updatedAt,
    specs: t.specs.map((s, i) => {
      const value = s.values.find((v) => v.id === input.selection[i]);
      return {
        nameZh: s.nameZh,
        nameEn: s.nameEn,
        valueZh: value.nameZh,
        valueEn: value.nameEn,
      };
    }),
  };
}
