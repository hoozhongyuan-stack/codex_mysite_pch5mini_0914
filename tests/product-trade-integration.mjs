import assert from 'node:assert/strict';
const base = 'http://localhost:3001',
  login = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
    redirect: 'manual',
  }),
  cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; '),
  tag = 'trade-' + Date.now(),
  created = [];
let checks = 0;
const get = (p) => fetch(base + p, { headers: { cookie } });
const post = (path, body) =>
  fetch(base + path, {
    method: 'POST',
    headers: { cookie, Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const save = (data) => post('/api/admin', { action: 'saveContent', data });
async function json(r) {
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d;
}
const check = (v, l) => {
  assert.ok(v, l);
  checks++;
};
const specs = [
  {
    id: 'color',
    nameZh: '颜色',
    nameEn: 'Color',
    values: [
      { id: 'red', nameZh: '红色', nameEn: 'Red' },
      { id: 'blue', nameZh: '蓝色', nameEn: 'Blue' },
    ],
  },
  {
    id: 'size',
    nameZh: '尺寸',
    nameEn: 'Size',
    values: [
      { id: 'small', nameZh: '小号', nameEn: 'Small' },
      { id: 'large', nameZh: '大号', nameEn: 'Large' },
    ],
  },
];
const trade = {
  specs,
  currency: 'CNY',
  inventory: 123456789,
  inventoryDisplay: 'hidden',
  variants: [
    { key: 'red~small', priceMinor: 19900, enabled: true },
    { key: 'large~red', priceMinor: 29900, enabled: true },
    { key: 'blue~small', priceMinor: null, enabled: true },
    { key: 'blue~large', priceMinor: 0, enabled: false },
  ],
};
try {
  const form = await json(
    await save({
      kind: 'forms',
      status: 'published',
      slug: tag + '-form',
      titleZh: '规格咨询',
      titleEn: 'Product inquiry',
      summaryZh: '测试',
      summaryEn: 'Test',
      fields: [
        {
          id: 'email',
          type: 'email',
          labelZh: '邮箱',
          labelEn: 'Email',
          required: true,
        },
      ],
    }),
  );
  created.push(form.id);
  const p = {
    kind: 'products',
    slug: tag,
    status: 'published',
    titleZh: '规格测试商品',
    titleEn: 'Options test product',
    summaryZh: '测试',
    summaryEn: 'Test',
    bodyZh: '商品正文',
    bodyEn: 'Product body',
    linkedFormId: form.id,
    trade,
  };
  const saved = await json(await save(p));
  created.push(saved.id);
  p.id = saved.id;
  const fetchProduct = async () => {
    const d = await json(await get('/api/admin/list?kind=products&q=' + tag));
    return d.rows.find((r) => r.id === saved.id);
  };
  let product = await fetchProduct();
  check(
    product.trade.variants.length === 4 &&
      product.trade.inventory === 123456789,
    'trade persisted',
  );
  check(
    (await save({ ...p, trade: { ...trade, inventory: -2 } })).status === 400,
    'negative stock rejected',
  );
  check(
    (
      await save({
        ...p,
        trade: {
          ...trade,
          variants: trade.variants.map((v) => ({ ...v, priceMinor: 1.5 })),
        },
      })
    ).status === 400,
    'fractional minor price rejected',
  );
  for (const lang of ['zh', 'en']) {
    const html = await (await get('/' + lang + '/products/' + tag)).text();
    check(
      html.includes('product-price') &&
        html.includes(lang === 'zh' ? '颜色' : 'Color'),
      'localized price/spec rendering',
    );
    check(
      !html.includes('123456789'),
      'hidden inventory not leaked to page payload',
    );
  }
  const forms = await json(await get('/api/admin/list?kind=forms&q=' + tag));
  const snap = await json(await get('/api/admin'));
  const body = {
    formId: form.id,
    formVersion: forms.rows[0].updatedAt,
    privacyVersion: snap.policies.find((p) => p.kind === 'privacy')?.version,
    values: { email: 'qa@example.test' },
    consent: true,
    sourceContentId: saved.id,
    productSelection: {
      version: product.updatedAt,
      selection: ['red', 'small'],
      priceMinor: 1,
    },
  };
  const sub = await json(await post('/api/submit', body));
  let detail = await json(await get('/api/admin/submission?id=' + sub.id));
  check(
    detail.source.product.priceMinor === 19900,
    'server price ignores forged client price',
  );
  check(
    detail.source.product.specs[1].valueEn === 'Small',
    'selected specs captured bilingually',
  );
  check(
    detail.source.product.inventory === null,
    'hidden stock excluded from inquiry snapshot',
  );
  const updated = {
    ...trade,
    inventory: 0,
    inventoryDisplay: 'quantity',
    variants: trade.variants.map((v) => ({
      ...v,
      priceMinor: v.priceMinor === 19900 ? 39900 : v.priceMinor,
    })),
  };
  await json(await save({ ...p, trade: updated }));
  product = await fetchProduct();
  check(
    (await post('/api/submit', body)).status === 409,
    'stale quote rejected',
  );
  check(
    (
      await post('/api/submit', {
        ...body,
        productSelection: {
          version: product.updatedAt,
          selection: ['blue', 'large'],
        },
      })
    ).status === 409,
    'disabled combination rejected',
  );
  const html = await (await get('/zh/products/' + tag)).text();
  check(html.includes('暂时缺货'), 'zero stock rendered');
  const next = await json(
    await post('/api/submit', {
      ...body,
      productSelection: {
        version: product.updatedAt,
        selection: ['red', 'small'],
      },
    }),
  );
  detail = await json(await get('/api/admin/submission?id=' + next.id));
  check(
    detail.source.product.priceMinor === 39900 &&
      detail.source.product.stockStatus === 'out',
    'new quote captures changed price and stock',
  );
  check(
    (await fetchProduct()).trade.inventory === 0,
    'inquiry does not deduct stock',
  );
  detail = await json(await get('/api/admin/submission?id=' + sub.id));
  check(
    detail.source.product.priceMinor === 19900,
    'historical quote unchanged',
  );
  const exported = await post('/api/admin/submission', { ids: [sub.id] });
  check(
    exported.ok && (await exported.text()).includes('199.00'),
    'CSV includes inquiry price',
  );
  console.log(
    checks +
      ' product trade integration checks passed; synthetic inquiry records retained.',
  );
} finally {
  for (const id of created.reverse())
    await post('/api/admin', { action: 'deleteContent', id });
}
