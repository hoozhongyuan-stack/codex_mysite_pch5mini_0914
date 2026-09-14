import assert from 'node:assert/strict';
const base = 'http://localhost:3001',
  login = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
    redirect: 'manual',
  }),
  cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
const get = (path, auth = true) =>
  fetch(base + path, { headers: auth ? { cookie } : {} });
const post = (path, body, auth = true, origin = base) =>
  fetch(base + path, {
    method: 'POST',
    headers: {
      ...(auth ? { cookie } : {}),
      Origin: origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
const tag = 'list-qa-' + Date.now(),
  created = [];
let checks = 0;
function check(v, label) {
  assert.ok(v, label);
  checks++;
}
async function json(r) {
  const d = await r.json();
  assert.ok(r.ok, JSON.stringify(d));
  return d;
}
try {
  for (const kind of ['articles', 'products', 'forms', 'submissions', 'logs'])
    check(
      (await get('/api/admin/list?kind=' + kind, false)).status === 401,
      'anonymous ' + kind,
    );
  check(
    (await get('/api/identity-admin/users', false)).status === 401,
    'anonymous users',
  );
  check(
    (await get('/api/admin/list?kind=articles&size=9999')).status === 400,
    'size bounded',
  );
  check(
    (await get('/api/admin/list?kind=articles&from=2026-09-09&to=2026-09-01'))
      .status === 400,
    'date range validation',
  );
  for (let i = 0; i < 22; i++) {
    const d = await json(
      await post('/api/admin', {
        action: 'saveContent',
        data: {
          kind: 'articles',
          slug: tag + '-' + i,
          titleZh: tag + ' ' + i,
          status: 'draft',
        },
      }),
    );
    created.push(d.id);
  }
  const first = await json(await get('/api/admin/list?kind=articles&q=' + tag));
  check(
    (await get('/preview/' + created[0])).status === 200,
    'owner draft preview',
  );
  check(
    (await get('/preview/' + created[0], false)).status === 404,
    'draft preview hidden from anonymous',
  );
  const second = await json(
    await get('/api/admin/list?kind=articles&q=' + tag + '&page=2'),
  );
  check(
    first.total === 22 && first.rows.length === 20 && second.rows.length === 2,
    'actual server pagination',
  );
  check(
    !first.rows.some((a) => second.rows.some((b) => b.id === a.id)),
    'stable pages without duplicates',
  );
  check(
    (
      await json(
        await get(
          '/api/admin/list?kind=articles&q=' + tag + '&status=published',
        ),
      )
    ).total === 0,
    'status filter',
  );
  check(
    (
      await json(
        await get(
          '/api/admin/list?kind=articles&q=' +
            encodeURIComponent("' OR 1=1 --"),
        ),
      )
    ).total === 0,
    'SQL injection treated literally',
  );
  const snap = await json(await get('/api/admin'));
  check(
    snap.submissions.length === 0 && snap.logs.length === 0,
    'bootstrap excludes private unpaged lists',
  );
  const form = await json(
    await post('/api/admin', {
      action: 'saveContent',
      data: {
        kind: 'forms',
        slug: tag + '-form',
        status: 'published',
        titleZh: tag,
        titleEn: 'List QA',
        summaryZh: '测试',
        summaryEn: 'test',
        fields: [
          {
            id: 'random-email-id',
            type: 'email',
            labelZh: '邮箱',
            labelEn: 'Email',
            required: true,
          },
        ],
      },
    }),
  );
  created.push(form.id);
  const forms = await json(await get('/api/admin/list?kind=forms&q=' + tag));
  const privacy = snap.policies.find((p) => p.kind === 'privacy');
  const submission = await json(
    await post(
      '/api/submit',
      {
        formId: form.id,
        formVersion: forms.rows[0].updatedAt,
        values: { 'random-email-id': tag + '@example.test' },
        consent: true,
        privacyVersion: privacy?.version,
        language: 'en',
      },
      false,
    ),
  );
  const found = await json(
    await get('/api/admin/list?kind=submissions&q=' + tag),
  );
  check(
    found.rows.some(
      (r) => r.id === submission.id && r.email === tag + '@example.test',
    ),
    'custom email searchable',
  );
  const before = await json(
    await get('/api/admin/submission?id=' + submission.id),
  );
  check(
    (
      await post('/api/admin', {
        action: 'updateSubmission',
        id: submission.id,
        data: { status: 'processing', note: 'Synthetic QA note' },
      })
    ).ok,
    'workflow save',
  );
  const after = await json(
    await get('/api/admin/submission?id=' + submission.id),
  );
  check(
    after.processingStatus === 'processing' && after.status === 'new',
    'processing independent of read',
  );
  check(
    JSON.stringify(before.values) === JSON.stringify(after.values) &&
      after.history[0].note === 'Synthetic QA note',
    'snapshot retained and history persisted',
  );
  await post('/api/admin', { action: 'markSubmission', id: submission.id });
  const read = await json(
    await get('/api/admin/submission?id=' + submission.id),
  );
  check(
    read.status === 'read' && read.processingStatus === 'processing',
    'read does not finish workflow',
  );
  check(
    (
      await post(
        '/api/admin/submission',
        { ids: [submission.id] },
        true,
        'https://evil.test',
      )
    ).status === 403,
    'export CSRF',
  );
  check(
    (await post('/api/admin/submission', { ids: [submission.id] }, false))
      .status === 401,
    'export auth',
  );
  const exported = await post('/api/admin/submission', {
    ids: [submission.id],
  });
  check(
    exported.ok && (await exported.text()).includes(tag + '@example.test'),
    'selected CSV exported',
  );
  const logs = await json(
    await get(
      '/api/admin/list?kind=logs&action=updateSubmission&module=submissions',
    ),
  );
  check(
    logs.rows.some((r) => r.target === submission.id) &&
      logs.rows.every((r) => r.action === 'updateSubmission'),
    'logs filters',
  );
  const users = await json(
    await get('/api/identity-admin/users?size=20&q=' + tag),
  );
  check(users.total === 0 && users.size === 20, 'user pagination proxy');
  check(
    (await get('/?view=submissions')).status === 200 &&
      (await get('/?view=logs')).status === 200,
    'standalone pages reachable',
  );
  console.log(
    `${checks} list integration checks passed. Synthetic submission ${submission.id} retained for audit.`,
  );
} finally {
  for (const id of created)
    await post('/api/admin', { action: 'deleteContent', id });
}
