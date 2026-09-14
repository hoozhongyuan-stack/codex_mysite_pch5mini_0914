import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTrade,
  combinations,
  priceMinor,
  inquirySnapshot,
  publicTrade,
  reconcileVariants,
  priceLabel,
} from '../lib/product-options.mjs';
const specs = [
  {
    id: 'color',
    nameZh: '颜色',
    nameEn: 'Color',
    values: [
      { id: 'red', nameZh: '红', nameEn: 'Red' },
      { id: 'blue', nameZh: '蓝', nameEn: 'Blue' },
    ],
  },
];
const trade = {
  specs,
  currency: 'CNY',
  inventory: 5,
  inventoryDisplay: 'quantity',
  variants: [
    { key: 'red', priceMinor: 19900, enabled: true },
    { key: 'blue', priceMinor: null, enabled: false },
  ],
};
test('exact money input avoids float rounding, blanks differ from zero', () => {
  assert.equal(priceMinor(''), null);
  assert.equal(priceMinor('0'), 0);
  assert.equal(priceMinor('19.99'), 1999);
  for (const x of ['-1', '1.001', 'NaN', '1e5', '100000000'])
    assert.throws(() => priceMinor(x));
});
test('three specs and 100 combinations enforced, duplicate identifiers rejected', () => {
  assert.equal(validateTrade({...trade,variants:trade.variants.map(v=>({...v,inventory:5}))}, true).variants.length, 2);
  assert.throws(() =>
    validateTrade({ ...trade, specs: [...specs, ...specs] }, true),
  );
  assert.throws(() => validateTrade({ ...trade, inventory: -1 }));
  assert.throws(() => validateTrade({ ...trade, inventory: 1.5 }));
  assert.throws(() =>
    combinations(
      Array.from({ length: 4 }, (_, i) => ({ ...specs[0], id: String(i) })),
    ),
  );
  assert.throws(() =>
    combinations([
      {
        id: 'a',
        values: Array.from({ length: 101 }, (_, i) => ({ id: String(i) })),
      },
    ]),
  );
  assert.throws(() =>
    validateTrade({ ...trade, variants: trade.variants.slice(0, 1) }),
  );
});
test('legacy defaults and private stock redaction', () => {
  const d = validateTrade();
  assert.equal(d.inventory, null);
  assert.equal(d.variants[0].priceMinor, null);
  assert.equal(
    publicTrade({ ...trade, inventoryDisplay: 'hidden' }).inventory,
    null,
  );
  assert.equal(
    publicTrade({ ...trade, inventoryDisplay: 'status' }).inventory,
    null,
  );
});
test('inquiry derives snapshot from trusted product, validates selection/version', () => {
  const p = { trade, updatedAt: 'v1', spu: 'TEST' };
  const r = inquirySnapshot(p, { version: 'v1', selection: ['red'] });
  assert.equal(r.priceMinor, 19900);
  assert.equal(r.specs[0].valueZh, '红');
  assert.throws(() =>
    inquirySnapshot(p, { version: 'v0', selection: ['red'] }),
  );
  assert.throws(() =>
    inquirySnapshot(p, { version: 'v1', selection: ['blue'] }),
  );
  assert.throws(() => inquirySnapshot(p, { version: 'v1', selection: [] }));
});

test('renaming and reordering retain prices; disabled combinations excluded from price range', () => {
  const sizes = {
    id: 'size',
    nameZh: '尺寸',
    nameEn: 'Size',
    values: [{ id: 's', nameZh: '小', nameEn: 'Small' }],
  };
  const dims = [...specs, sizes],
    variants = [
      { key: 'red~s', priceMinor: 19900, enabled: true },
      { key: 'blue~s', priceMinor: 99900, enabled: false },
    ];
  assert.deepEqual(reconcileVariants([...dims].reverse(), variants), variants);
  assert.deepEqual(
    reconcileVariants([{ ...specs[0], nameZh: '新颜色' }, sizes], variants),
    variants,
  );
  assert.equal(priceLabel({ ...trade, variants }, '', false), '¥199.00');
  const status = publicTrade({ ...trade, inventoryDisplay: 'status' });
  assert.equal(publicTrade(status).stockStatus, 'in');
  assert.equal(publicTrade(status).inventory, null);
});
test('points reward and redemption settings reject invalid integer limits',()=>{
 for(const key of ['redemptionQuota','redemptionLimit','redemptionSort','rewardPoints'])for(const value of [-1,1.5,'2'])assert.throws(()=>validateTrade({...trade,[key]:value}));
 assert.equal(validateTrade({...trade,redemptionQuota:10,redemptionLimit:2,redemptionSort:3}).redemptionSort,3);
});

test('published stock required for every enabled variant while drafts may omit it', () => {
 const single={...trade,specs:[],inventory:null,variants:[{key:'default',enabled:true,priceMinor:100}]};
 assert.throws(()=>validateTrade(single,true),/库存/);
 assert.equal(validateTrade(single).inventory,null);
 assert.throws(()=>validateTrade(trade,true),/库存/);
 const configured={...trade,variants:trade.variants.map(v=>({...v,inventory:v.enabled?3:null}))};
 assert.equal(validateTrade(configured,true).inventory,3);
 assert.equal(validateTrade(configured,true).inventoryMode,'variants');
 assert.throws(()=>validateTrade({...configured,variants:configured.variants.map(v=>({...v,inventory:-1}))}),/库存/);
});
