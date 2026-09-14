import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContent,
  validateSubmission,
  validateSettings,
  classifyVisit,
  safeJson,
  allowedAdmin,
  validMedia,
} from '../lib/domain.mjs';
const record = {
  kind: 'articles',
  slug: 'hello-world',
  titleZh: '你好',
  titleEn: 'Hello',
  summaryZh: '摘要',
  summaryEn: 'Summary',
  bodyZh: '正文',
  bodyEn: 'Body',
  status: 'published',
};
test('published content requires complete independent languages', () => {
  assert.equal(validateContent(record).titleEn, 'Hello');
  assert.throws(() => validateContent({ ...record, titleEn: '' }));
});
test('rejects arbitrary record kinds and unsafe slugs', () => {
  assert.throws(() => validateContent({ ...record, kind: 'admins' }));
  assert.throws(() => validateContent({ ...record, slug: '../../admin' }));
});
test('draft may omit translation; input remains unchanged', () => {
  const input = { ...record, status: 'draft', titleEn: '' };
  const copy = structuredClone(input);
  assert.equal(validateContent(input).status, 'draft');
  assert.deepEqual(input, copy);
});
test('reject oversized and invalid form submissions', () => {
  assert.throws(() =>
    validateSubmission({
      formId: 'contact',
      name: 'A',
      email: 'broken',
      message: 'Hi',
      consent: true,
    }),
  );
  assert.throws(() =>
    validateSubmission({
      formId: 'contact',
      name: 'A',
      email: 'a@b.co',
      message: 'x'.repeat(6001),
      consent: true,
    }),
  );
  assert.throws(() =>
    validateSubmission({
      formId: 'contact',
      name: 'A',
      email: 'a@b.co',
      message: 'Hi',
      consent: false,
    }),
  );
});
test('valid submission normalizes email', () =>
  assert.equal(
    validateSubmission({
      formId: 'contact',
      name: 'A',
      email: 'A@B.CO',
      message: 'Hi',
      consent: true,
    }).email,
    'a@b.co',
  ));
test('theme whitelist and title are enforced', () => {
  assert.throws(() => validateSettings({ theme: 'evil' }));
  assert.equal(
    validateSettings({ theme: 'editorial', nameZh: '品牌', nameEn: 'Brand' })
      .theme,
    'editorial',
  );
});
test('bot claims are not verified identity and referrals require exact hosts', () => {
  assert.equal(classifyVisit('GPTBot', '').kind, 'claimed_bot');
  assert.equal(
    classifyVisit('Browser', 'https://chatgpt.com/c/1').kind,
    'ai_referral',
  );
  assert.equal(
    classifyVisit('Browser', 'https://chatgpt.com.evil.test').kind,
    'other',
  );
});
test('JSON-LD escapes closing script tags', () =>
  assert.ok(
    !safeJson({ text: '</script><script>alert(1)</script>' }).includes('<'),
  ));
test('admin fails closed and local identity is development only', () => {
  assert.equal(allowedAdmin('a@b.co', '', false), false);
  assert.equal(allowedAdmin('seedy@sites.test', '', false), false);
  assert.equal(allowedAdmin('seedy@sites.test', '', true), true);
  assert.equal(allowedAdmin('A@b.co', 'a@b.co', false), true);
});
test('upload accepts limited image/video mime and size', () => {
  assert.equal(validMedia('image/png', 30), true);
  assert.equal(validMedia('image/svg+xml', 30), false);
  assert.equal(validMedia('video/mp4', 31 * 1024 * 1024), false);
});
test('publication errors identify the field that needs editing', () => {
  assert.throws(() => validateContent({ ...record, titleEn: '' }), /英文标题/);
  assert.throws(() => validateContent({ ...record, summaryZh: '' }), /中文摘要/);
  assert.throws(() => validateContent({ ...record, bodyZh: '' }), /中文正文/);
});

const imageDoc = { type: 'doc', content: [{ type: 'image', attrs: { src: '/api/media/11111111-1111-1111-1111-111111111111', alt: '图片' } }] };
for (const kind of ['articles', 'products']) {
  test(`${kind}: images are valid body content and do not count as text`, () => {
    const result = validateContent({ ...record, kind, trade: {specs:[],currency:"CNY",inventory:0,inventoryDisplay:"hidden",variants:[{key:"default",priceMinor:100,enabled:true}]}, richZh: imageDoc, richEn: imageDoc });
    assert.equal(result.bodyZh, '');
    assert.equal(result.richZh.content[0].type, 'image');
  });
}
test('missing body and excessive text report distinct errors; rich text is not truncated', () => {
  assert.throws(() => validateContent({ ...record, bodyZh: '' }), /中文正文不能为空$/);
  assert.throws(() => validateContent({ ...record, richZh: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '字'.repeat(30001) }] }] } }), /30000/);
});
test('draft preserves incomplete publishing fields', () => {
  const result = validateContent({ ...record, status: 'draft', titleEn: '', summaryZh: '', summaryEn: '', bodyZh: '', bodyEn: '' });
  assert.equal(result.status, 'draft');
});
test('images do not affect text limit boundaries and empty paragraphs remain empty', () => {
  const doc = (length) => ({ type: 'doc', content: [...imageDoc.content, { type: 'paragraph', content: [{ type: 'text', text: '字'.repeat(length) }] }] });
  assert.equal(validateContent({ ...record, richZh: doc(30000) }).bodyZh.length, 30000);
  assert.throws(() => validateContent({ ...record, richZh: doc(30001) }), /中文正文超过30000/);
  assert.throws(() => validateContent({ ...record, richZh: { type: 'doc', content: [{ type: 'paragraph' }] } }), /中文正文不能为空/);
});
