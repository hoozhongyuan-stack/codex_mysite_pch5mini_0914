import assert from 'node:assert/strict';
const base = 'http://localhost:3001';
const login = await fetch(base + '/signin-with-chatgpt?return_to=%2F', {
  redirect: 'manual',
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
const get = (p, auth = false) =>
  fetch(base + p, { headers: auth ? { cookie } : {} });
const save = (data, origin = base, auth = true) =>
  fetch(base + '/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(auth ? { cookie } : {}),
    },
    body: JSON.stringify({ action: 'saveFooter', data }),
  });
const before = await (await get('/api/admin', true)).json();
const original = before.settings.footer || {
  copyrightUrl: 'https://aition.art',
  navIds: before.navigation.filter((n) => n.enabled).map((n) => n.id),
  policyKinds: ['terms', 'privacy', 'cookies'],
  socials: [],
  registrations: [],
};
let passed = 0;
const check = (v, label) => {
  assert.ok(v, label);
  passed++;
};
const sample = {
  ...original,
  companyZh: '页脚验收公司',
  companyEn: 'Footer Acceptance Company',
  addressZh: '本地测试地址',
  addressEn: 'Local test address',
  phone: '+86 010 12345678',
  email: 'footer@example.test',
  copyrightZh: '页脚版权测试',
  copyrightEn: 'Footer copyright test',
  copyrightUrl: 'https://aition.art',
  registrations: [
    { label: '本地测试备案（非真实）', url: 'https://example.test/record' },
  ],
  socials: [
    {
      platform: 'linkedin',
      kind: 'link',
      labelZh: '领英',
      labelEn: 'LinkedIn',
      url: 'https://www.linkedin.com',
      enabled: true,
    },
  ],
};
try {
  check(
    (await save(sample, base, false)).status === 401,
    'Anonymous footer update denied',
  );
  check(
    (await save(sample, 'https://evil.example')).status === 403,
    'Cross origin update denied',
  );
  check(
    (await save({ ...sample, copyrightUrl: 'javascript:alert(1)' })).status ===
      400,
    'Unsafe URL rejected',
  );
  const r = await save(sample);
  check(r.ok, 'Footer configuration saved');
  for (const lang of ['zh', 'en']) {
    const response = await get('/' + lang),
      html = await response.text();
    check(response.ok, 'Page renders');
    check(
      html.includes(
        lang === 'zh' ? '页脚验收公司' : 'Footer Acceptance Company',
      ),
      'Bilingual company rendered',
    );
    check(html.includes('mailto:footer@example.test'), 'Email link emitted');
    check(html.includes('https://aition.art'), 'Copyright target emitted');
    check(
      html.includes('https://example.test/record'),
      'Registration target emitted',
    );
    check(html.includes('footer-policy-row'), 'Policy row rendered');
  }
  const account = await (await get('/zh/account')).text();
  check(account.includes('footer-links'), 'Account footer retains nav');
  const after = await (await get('/api/admin', true)).json();
  check(after.settings.theme === before.settings.theme, 'Theme preserved');
  check(
    (
      await (
        await get('/api/admin/list?kind=logs&action=saveFooter', true)
      ).json()
    ).rows.some((l) => l.action === 'saveFooter'),
    'Operation logged',
  );
  console.log(JSON.stringify({ passed, scope: 'Local footer HTTP workflows' }));
} finally {
  const r = await save(original);
  assert.ok(r.ok, 'Restore footer baseline');
}
