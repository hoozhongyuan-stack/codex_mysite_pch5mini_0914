import assert from 'node:assert/strict';
const base = 'http://localhost:3001',
  auth = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
    redirect: 'manual',
  }),
  cookie = auth.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; '),
  tag = 'attached-' + Date.now();
let passed = 0;
const contents = [],
  cats = [];
const check = (v, l) => {
  assert.ok(v, l);
  passed++;
};
const get = (p) => fetch(base + p, { headers: { cookie } });
const post = (path, data) =>
  fetch(base + path, {
    method: 'POST',
    headers: { cookie, Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
async function json(r) {
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d;
}
const save = (data) => post('/api/admin', { action: 'saveContent', data });
try {
  const cat = await json(
    await post('/api/admin', {
      action: 'saveCategory',
      data: { kind: 'articles', nameZh: tag, nameEn: 'Parent' },
    }),
  );
  cats.push(cat.id);
  const child = await json(
    await post('/api/admin', {
      action: 'saveCategory',
      data: {
        kind: 'articles',
        parentId: cat.id,
        nameZh: '二级',
        nameEn: 'Child',
      },
    }),
  );
  cats.push(child.id);
  check(!!child.id, 'article child created');
  check(
    (
      await post('/api/admin', {
        action: 'saveCategory',
        data: {
          kind: 'articles',
          parentId: child.id,
          nameZh: '三级',
          nameEn: 'Third',
        },
      })
    ).status === 400,
    'third level rejected',
  );
  const formData = {
    kind: 'forms',
    slug: tag + '-form',
    status: 'published',
    titleZh: '关联表单测试',
    titleEn: 'Attached form test',
    summaryZh: '测试',
    summaryEn: 'Test',
    fields: [
      {
        id: 'email',
        type: 'email',
        required: true,
        labelZh: '邮箱',
        labelEn: 'Email',
      },
    ],
  };
  const form = await json(await save(formData));
  contents.push(form.id);
  const snap = await json(await get('/api/admin'));
  const privacy = snap.policies.find((p) => p.kind === 'privacy')?.version;
  for (const kind of ['articles', 'products']) {
    const data = {
      kind,
      slug: tag + '-' + kind,
      status: 'published',
      titleZh: '关联内容',
      titleEn: 'Attached content',
      summaryZh: '测试',
      summaryEn: 'Test',
      bodyZh: '正文',
      bodyEn: 'Body',
      linkedFormId: form.id,
      ...(kind === 'articles' ? { categoryId: child.id } : {}),
    };
    const record = await json(await save(data));
    contents.push(record.id);
    for (const lang of ['zh', 'en']) {
      const html = await (
        await get('/' + lang + '/' + kind + '/' + data.slug)
      ).text();
      check(
        html.includes('detail-attached-form') &&
          html.includes(lang === 'zh' ? '关联表单测试' : 'Attached form test'),
        'localized embedded form',
      );
    }
    const list = await json(await get('/api/admin/list?kind=forms&q=' + tag));
    const sub = await json(
      await post('/api/submit', {
        formId: form.id,
        formVersion: list.rows[0].updatedAt,
        privacyVersion: privacy,
        values: { email: 'qa@example.test' },
        consent: true,
        sourceContentId: record.id,
        ...(kind === 'products'
          ? {
              productSelection: {
                version: (
                  await json(
                    await get('/api/admin/list?kind=products&q=' + tag),
                  )
                ).rows.find((r) => r.id === record.id).updatedAt,
                selection: [],
              },
            }
          : {}),
      }),
    );
    const detail = await json(await get('/api/admin/submission?id=' + sub.id));
    check(
      detail.source.id === record.id && detail.source.kind === kind,
      'trusted source snapshot',
    );
    if (kind === 'articles') {
      const filtered = await json(
        await get('/api/admin/list?kind=articles&category=' + cat.id),
      );
      check(
        filtered.rows.some((r) => r.id === record.id),
        'parent filter includes child articles',
      );
    }
    await json(await save({ ...data, id: record.id, linkedFormId: '' }));
    check(
      !(await (await get('/zh/' + kind + '/' + data.slug)).text()).includes(
        'detail-attached-form',
      ),
      'optional form removal',
    );
    check(
      (
        await post('/api/submit', {
          formId: form.id,
          formVersion: list.rows[0].updatedAt,
          privacyVersion: privacy,
          values: { email: 'qa@example.test' },
          consent: true,
          sourceContentId: record.id,
          ...(kind === 'products'
            ? {
                productSelection: {
                  version: (
                    await json(
                      await get('/api/admin/list?kind=products&q=' + tag),
                    )
                  ).rows.find((r) => r.id === record.id).updatedAt,
                  selection: [],
                },
              }
            : {}),
        })
      ).status === 409,
      'stale association rejected',
    );
    await json(await save({ ...data, id: record.id }));
  }
  await json(await save({ ...formData, id: form.id, status: 'draft' }));
  for (const kind of ['articles', 'products'])
    check(
      !(
        await (await get('/zh/' + kind + '/' + tag + '-' + kind)).text()
      ).includes('detail-attached-form'),
      'unpublished form hidden',
    );
  console.log(
    passed + ' attached-form checks passed; synthetic submissions retained.',
  );
} finally {
  for (const id of contents.reverse())
    await post('/api/admin', { action: 'deleteContent', id });
  for (const id of cats.reverse())
    await post('/api/admin', { action: 'deleteCategory', id });
}
