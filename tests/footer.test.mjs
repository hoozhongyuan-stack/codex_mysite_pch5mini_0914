import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFooter, footerAssetIds } from '../lib/footer-domain.mjs';
test('footer validates bilingual company details and safe external links', () => {
  const input = {
    companyZh: '公司',
    companyEn: 'Company',
    copyrightUrl: 'https://aition.art',
    email: 'hello@example.test',
    registrations: [{ label: '备案示例', url: 'https://example.test/record' }],
  };
  const result = validateFooter(input);
  assert.equal(result.companyEn, 'Company');
  assert.equal(result.registrations.length, 1);
  assert.equal(input.companyZh, '公司');
  assert.throws(() =>
    validateFooter({ ...input, copyrightUrl: 'javascript:alert(1)' }),
  );
  assert.throws(() => validateFooter({ ...input, email: 'invalid' }));
});
test('social QR requires an asset; links require HTTPS; only visible QR assets are public', () => {
  const id = '12345678-1234-1234-1234-123456789012';
  const data = validateFooter({
    socials: [
      {
        platform: 'wechat',
        kind: 'qr',
        labelZh: '微信',
        labelEn: 'WeChat',
        imageId: id,
        enabled: true,
      },
    ],
  });
  assert.deepEqual(footerAssetIds(data), [id]);
  assert.throws(() =>
    validateFooter({
      socials: [{ kind: 'qr', labelZh: '微信', labelEn: 'WeChat' }],
    }),
  );
  assert.throws(() =>
    validateFooter({ socials: [{ kind: 'link', url: 'http://example.test' }] }),
  );
  assert.deepEqual(
    footerAssetIds({
      ...data,
      socials: data.socials.map((s) => ({ ...s, enabled: false })),
    }),
    [],
  );
});
test('footer limits repeated entries and preserves policy/nav order', () => {
  const d = validateFooter({
    navIds: ['b', 'a', 'b'],
    policyKinds: ['privacy', 'terms', 'privacy'],
    year: '2020–2026',
  });
  assert.deepEqual(d.navIds, ['b', 'a']);
  assert.deepEqual(d.policyKinds, ['privacy', 'terms']);
  assert.throws(() => validateFooter({ socials: Array(13).fill({}) }));
  assert.throws(() => validateFooter({ policyKinds: ['unknown'] }));
});
