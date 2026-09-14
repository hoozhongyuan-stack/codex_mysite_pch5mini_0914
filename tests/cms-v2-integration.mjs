import assert from 'node:assert/strict';
const base = 'http://localhost:3001';
const login = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
  redirect: 'manual',
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
let count = 0;
const check = (value, label) => {
  assert.ok(value, label);
  count++;
};
const get = (path, auth = true) =>
  fetch(base + path, { headers: auth ? { cookie } : {} });
const post = (action, data = {}, id) =>
  fetch(base + '/api/admin', {
    method: 'POST',
    headers: { cookie, Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data, id }),
  });
const save = async (action, data) => {
  const r = await post(action, data);
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d.id;
};
const tag = 'v2-' + Date.now(),
  clean = [];
const category = (kind, parentId = '') => ({
  kind,
  parentId,
  nameZh: '集成测试分类',
  nameEn: 'Integration category',
});
const content = {
  kind: 'articles',
  slug: tag,
  status: 'published',
  titleZh: '测试富文本',
  titleEn: 'Rich test',
  summaryZh: '测试摘要',
  summaryEn: 'Test summary',
  bodyZh: '测试内容',
  bodyEn: 'Test body',
};
try {
  check(
    (await get('/login', false)).status === 200,
    'Particle login route available',
  );
  const root = await save('saveCategory', category('products'));
  clean.push(['deleteCategory', root]);
  const child = await save('saveCategory', category('products', root));
  clean.push(['deleteCategory', child]);
  check(
    (await post('saveCategory', category('products', child))).status === 400,
    'Third category level rejected',
  );
  check(
    (await post('saveCategory', category('articles', root))).status === 400,
    'Article parent rejected',
  );
  check(
    (await post('deleteCategory', {}, root)).status === 400,
    'Referenced parent protected',
  );
  const cat = await save('saveCategory', category('articles'));
  clean.push(['deleteCategory', cat]);
  const rich = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
        ],
      },
    ],
  };
  const article = await save('saveContent', {
    ...content,
    categoryId: cat,
    richZh: rich,
    richEn: rich,
  });
  clean.push(['deleteContent', article]);
  const html = await (await get('/en/articles/' + tag, false)).text();
  check(
    html.includes('Hello <strong>world</strong>'),
    'Rich SSR preserves marked text spaces',
  );
  const nav = await save('saveNav', {
    labelZh: '测试导航',
    labelEn: 'Test nav',
    targetType: 'articleCategory',
    targetId: cat,
    sort: 1,
  });
  clean.push(['deleteNav', nav]);
  check(
    (await post('deleteCategory', {}, cat)).status === 400,
    'Navigation/category content reference protected',
  );
  check(
    (await (await get('/zh', false)).text()).includes('/zh/categories/' + cat),
    'Navigation rendered server-side',
  );
  check(
    (await (await get('/zh/categories/' + cat, false)).text()).includes(
      '测试富文本',
    ),
    'Category lists linked article',
  );
  check(
    (
      await post('saveNav', {
        labelZh: '错误',
        labelEn: 'Bad',
        targetType: 'product',
        targetId: article,
      })
    ).status === 400,
    'Navigation target type checked',
  );
  const folder = await save('saveFolder', { name: '原名称' });
  clean.push(['deleteFolder', folder]);
  await save('saveFolder', { id: folder, name: '新名称' });
  check(
    (await (await get('/api/admin')).json()).folders.some(
      (f) => f.id === folder && f.name === '新名称',
    ),
    'Folder rename persists',
  );
  const fields = [
    {
      id: 'email',
      type: 'email',
      labelZh: '邮箱',
      labelEn: 'Email',
      required: true,
    },
    {
      id: 'picture',
      type: 'image',
      labelZh: '图片',
      labelEn: 'Picture',
      required: true,
    },
    {
      id: 'amount',
      type: 'number',
      labelZh: '数量',
      labelEn: 'Amount',
      required: true,
      min: 1,
      max: 5,
    },
  ];
  const form = await save('saveContent', {
    ...content,
    kind: 'forms',
    slug: tag + '-form',
    fields,
  });
  clean.push(['deleteContent', form]);
  const snapshot = await (await get('/api/admin')).json();
  const version = snapshot.contents.find((c) => c.id === form).updatedAt;
  const body = new FormData();
  body.set('formId', form);
  body.set('fieldId', 'picture');
  body.set(
    'file',
    new Blob(
      [
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0V8AAAAASUVORK5CYII=',
          'base64',
        ),
      ],
      { type: 'image/png' },
    ),
    'test.png',
  );
  const upload = await fetch(base + '/api/form-upload', {
    method: 'POST',
    headers: { Origin: base },
    body,
  });
  const file = await upload.json();
  check(upload.ok, 'Anonymous form image uploads');
  const visitorCookie = upload.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const submit = (withCookie, override = {}) =>
    fetch(base + '/api/submit', {
      method: 'POST',
      headers: {
        Origin: base,
        'Content-Type': 'application/json',
        ...(withCookie ? { cookie: visitorCookie } : {}),
      },
      body: JSON.stringify({
        formId: form,
        formVersion: version,
        consent: true,
        values: { email: 'qa@example.test', picture: file.id, amount: 3 },
        ...override,
      }),
    });
  check(
    (await submit(false)).status === 400,
    'Other session cannot claim image',
  );
  check(
    (await submit(true, { formVersion: 'stale' })).status === 409,
    'Stale form version rejected',
  );
  check(
    (await get('/api/submission-file/' + file.id, false)).status === 401,
    'Anonymous attachment read denied',
  );
  const submitted = await submit(true);
  check(submitted.status === 201, 'Dynamic form submitted with owned image');
  check(
    (await get('/api/submission-file/' + file.id)).status === 200,
    'Admin can read submitted private image',
  );
  check(
    (await get('/api/media/' + file.id, false)).status === 401,
    'Form image absent from public media',
  );
  const after = await (await get('/api/admin')).json();
  check(
    (await (await get('/api/admin/list?kind=logs&action=saveCategory')).json()).rows.some((l) => l.action === 'saveCategory' && l.target === cat),
    'Operation log persisted',
  );
  console.log(
    JSON.stringify(
      { passed: count, scope: 'Local v2 HTTP workflows' },
      null,
      2,
    ),
  );
} finally {
  for (const [action, id] of clean.reverse()) await post(action, {}, id);
}
