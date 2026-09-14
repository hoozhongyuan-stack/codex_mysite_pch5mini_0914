import assert from 'node:assert/strict';
const base = 'http://localhost:3001';
const login = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
  redirect: 'manual',
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const report = [];
const check = (condition, label) => {
  assert.ok(condition, label);
  report.push(label);
};
async function get(path, auth = false, extra = {}) {
  return fetch(base + path, {
    headers: { ...(auth ? { cookie } : {}), ...extra },
  });
}
async function post(path, payload, auth = true, origin = base) {
  return fetch(base + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(auth ? { cookie } : {}),
    },
    body: JSON.stringify(payload),
  });
}
const initial = await (await get('/api/admin', true)).json();
check(Array.isArray(initial.contents), 'Authenticated snapshot loads');
check((await get('/api/admin')).status === 401, 'Anonymous admin API denied');
check(
  (
    await post(
      '/api/admin',
      { action: 'saveSettings', data: initial.settings },
      true,
      'https://evil.example',
    )
  ).status === 403,
  'Cross-origin write denied',
);
const tag = 'qa-' + Date.now();
const created = [];
let submissionId;
try {
  const draft = {
    kind: 'articles',
    slug: tag,
    status: 'draft',
    titleZh: '测试文章',
    titleEn: 'Test story',
    summaryZh: '真实测试摘要',
    summaryEn: 'Integration test summary',
    bodyZh:
      '## 测试小标题\n\n服务端可读取的测试正文。\n\n</script><script>alert(1)</script>',
    bodyEn: '## Evidence\n\nA server-rendered integration test story.',
    author: 'QA',
    category: '测试',
  };
  let r = await post('/api/admin', { action: 'saveContent', data: draft });
  check(r.ok, 'Draft saved');
  const { id } = await r.json();
  created.push(id);
  check(
    (await get('/zh/articles/' + tag)).status === 404,
    'Draft detail not public',
  );
  r = await post('/api/admin', {
    action: 'saveContent',
    data: { ...draft, id, status: 'published', titleEn: '' },
  });
  check(r.status === 400, 'Incomplete translation blocks publish');
  r = await post('/api/admin', {
    action: 'saveContent',
    data: { ...draft, id, status: 'published' },
  });
  check(r.ok, 'Complete translation publishes');
  const zh = await (await get('/zh/articles/' + tag)).text();
  const en = await (await get('/en/articles/' + tag)).text();
  check(zh.includes('服务端可读取的测试正文'), 'Chinese body server-rendered');
  check(
    en.includes('A server-rendered integration test story.'),
    'English body server-rendered',
  );
  check(!zh.includes('<script>alert(1)</script>'), 'Script injection escaped');
  check(
    en.includes('rel="canonical"') && en.includes('/en/articles/' + tag),
    'Canonical metadata emitted',
  );
  check(en.includes('application/ld+json'), 'Structured data emitted');
  const sitemap = await (await get('/sitemap.xml')).text();
  check(
    sitemap.includes('/zh/articles/' + tag) &&
      sitemap.includes('/en/articles/' + tag),
    'Sitemap includes both published translations',
  );
  const form = {
    ...draft,
    kind: 'forms',
    slug: tag + '-form',
    status: 'published',
  };
  r = await post('/api/admin', { action: 'saveContent', data: form });
  check(r.ok, 'Form published');
  const f = await r.json();
  created.push(f.id);
  r = await post(
    '/api/submit',
    {
      formId: f.id,
      name: 'QA visitor',
      email: 'qa@example.test',
      message: 'Synthetic integration test',
      language: 'en',
      consent: true,
    },
    false,
  );
  check(r.status === 201, 'Anonymous valid form persists');
  submissionId = (await r.json()).id;
  const snapshot = {submissions:(await (await get('/api/admin/list?kind=submissions&form='+f.id, true)).json()).rows};
  check(
    snapshot.submissions.some((s) => s.id === submissionId),
    'Submission read back by admin',
  );
  r = await post('/api/admin', { action: 'markSubmission', id: submissionId });
  check(r.ok, 'Submission marked read');
  for (const theme of ['tech', 'minimal', 'editorial']) {
    r = await post('/api/admin', {
      action: 'saveSettings',
      data: { ...initial.settings, theme },
    });
    check(r.ok, 'Theme ' + theme + ' saves');
    const h = await (await get('/zh')).text();
    check(h.includes('public-' + theme), 'Theme ' + theme + ' renders');
  }
  check(
    (await get('/en/not-a-route')).status === 404,
    'Unknown route returns 404',
  );
  check((await get('/robots.txt')).status === 200, 'Robots resource available');
  console.log(
    JSON.stringify(
      { passed: report.length, checks: report, submissionId },
      null,
      2,
    ),
  );
} finally {
  for (const id of created)
    await post('/api/admin', { action: 'deleteContent', id });
  await post('/api/admin', { action: 'saveSettings', data: initial.settings });
}
