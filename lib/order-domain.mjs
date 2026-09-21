import {miniPayments} from './mini-business.mjs';
import { countryCode } from './order-countries.mjs';
import { currencies } from './product-options.mjs';
export const orderStatuses = {
  pending_payment: '待付款',
  pending_review: '待审核',
  pending_ship: '待发货',
  pending_receive: '待签收',
  aftersale: '售后中',
  completed: '已完成',
  closed: '已关闭',
};
export function text(value, max = 200, required = false) {
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw Error('请完整填写信息，且不要超过长度限制');
  return value.trim();
}
export function integer(value, min = 0, max = 999999999999) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw Error('数量或金额无效');
  return value;
}
export function orderConfig(input) {
  const enabled = input.enabled === true;
  const legacy = miniPayments(input.miniPayments, true);
  const paymentChannels = { offline: input.paymentChannels?.offline === true || legacy.offline, wechat: input.paymentChannels?.wechat === true || legacy.wechat };
  const afterSaleDays = input.afterSaleDays;
  if (enabled || paymentChannels.offline) integer(afterSaleDays, 0, 3650);
  const shipping = Object.fromEntries(
    currencies.map((c) => [
      c,
      integer(input.shipping?.[c] ?? 0, 0, 9999999999),
    ]),
  );
  if (!Array.isArray(input.methods) || input.methods.length > 20)
    throw Error('收款项目最多20项');
  const ids = new Set();
  const methods = input.methods.map((m) => {
    const id = text(m.id, 60, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id))
      throw Error('收款项目标识重复或无效');
    ids.add(id);
    const imageId = text(m.imageId || '', 36);
    if (imageId && !/^[a-f0-9-]{36}$/.test(imageId))
      throw Error('收款图片无效');
    return {
      id,
      nameZh: text(m.nameZh, 100, true),
      nameEn: text(m.nameEn, 100, true),
      instructionsZh: text(m.instructionsZh || '', 3000),
      instructionsEn: text(m.instructionsEn || '', 3000),
      imageId,
      enabled: m.enabled !== false,
    };
  });
  if ((enabled || paymentChannels.offline) && !methods.some((m) => m.enabled))
    throw Error('启用交易前至少配置一种收款方式');
  return {
    enabled, paymentChannels, miniPayments: paymentChannels,
    timeoutHours: integer(input.timeoutHours ?? 24, 1, 720),
    afterSaleDays:
      afterSaleDays == null ? null : integer(afterSaleDays, 0, 3650),
    shipping,
    methods,
  };
}
export function address(input) {
  return {
    name: text(input.name, 100, true),
    phone: text(input.phone, 30, true),
    country: countryCode(input.country),
    city: text(input.city, 100, true),
    street: text(input.street, 500, true),
    province: text(input.province ?? '',100), district: text(input.district ?? '',100), postalCode: text(input.postalCode ?? '',20), label: text(input.label ?? '',40),
    isDefault: input.isDefault === true,
  };
}
export function checkout(input, products, config) {
  if (!config.enabled) throw Error('暂未开放交易');
  if (!Array.isArray(input) || !input.length || input.length > 30)
    throw Error('每单请选择1至30个商品规格');
  const merged = new Map();
  for (const line of input) {
    const key =
      text(line.productId, 80, true) + ':' + text(line.variant, 200, true);
    const old = merged.get(key);
    merged.set(key, {
      productId: line.productId,
      variant: line.variant,
      quantity: integer(
        (old?.quantity || 0) + integer(line.quantity, 1, 999),
        1,
        999,
      ),
    });
  }
  let currency = null;
  const items = [...merged.values()].map((line) => {
    const product = products.find((p) => p.id === line.productId),
      trade = product?.trade;
    const variant = trade?.variants?.find(
      (v) => v.key === line.variant && v.enabled === true,
    );
    if (
      product?.status !== 'published' ||
      !variant ||
      variant.priceMinor == null
    )
      throw Error('商品已下架、规格停用或价格面议，请重新选择');
    if (currency && currency !== trade.currency)
      throw Error('不同币种请分开下单');
    currency = trade.currency;
    if (trade.inventory == null || (trade.inventoryMode === 'variants' && variant.inventory == null)) throw Error('商品尚未设置可售库存');
    if (trade.inventoryMode === 'variants' && variant.inventory < line.quantity) throw Error('所选规格库存不足');
    const unitPrice = integer(variant.priceMinor, 0, 9999999999);
    return {
      ...line,
      unitPrice,
      rewardPoints: integer(trade.rewardPoints ?? 0, 0, 1000000),
      titleZh: product.titleZh,
      titleEn: product.titleEn,
      spu: product.spu || '',
      imageId: product.imageId || product.imageIds?.[0] || '',
      specs: (trade.specs || []).map((s) => ({
        nameZh: s.nameZh,
        nameEn: s.nameEn,
        values: s.values.filter((v) => line.variant.split('~').includes(v.id)),
      })),
    };
  });
  const subtotal = integer(
    items.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
  );
  const shipping = integer(config.shipping[currency]);
  return {
    items,
    currency,
    subtotal,
    shipping,
    total: integer(subtotal + shipping),
  };
}
export function transition(order, action, role, data = {}) {
  const rule = {
    proof: ['user', ['pending_payment'], 'pending_review'],
    cancel: ['user', ['pending_payment'], 'closed'],
    close: ['manage', ['pending_payment', 'pending_review'], 'closed'],
    approve: ['finance', ['pending_review'], 'pending_ship'],
    reject: ['finance', ['pending_review'], 'pending_payment'],
    ship: ['fulfill', ['pending_ship'], 'pending_receive'],
    receive: ['user', ['pending_receive'], 'completed'],
    aftersale: [
      'user',
      ['pending_ship', 'pending_receive', 'completed'],
      'aftersale',
    ],
    withdraw: ['user', ['aftersale'], order.priorStatus],
    reject_aftersale: ['aftersale', ['aftersale'], order.priorStatus],
    refund: ['aftersale', ['aftersale'], 'closed'],
  }[action];
  if (
    !rule ||
    !rule[1].includes(order.status) ||
    (role !== 'owner' && role !== rule[0])
  )
    throw Error('当前状态或权限不允许此操作');
  if (['reject', 'reject_aftersale', 'close'].includes(action))
    text(data.reason, 500, true);
  if (
    ['approve', 'refund'].includes(action) &&
    integer(data.amount) !== order.total
  )
    throw Error('首期仅支持全额到账或整单退款');
  if (
    action === 'refund' &&
    order.priorStatus !== 'pending_ship' &&
    data.returned !== true
  )
    throw Error('请先核实退货已收到');
  return rule[2];
}
