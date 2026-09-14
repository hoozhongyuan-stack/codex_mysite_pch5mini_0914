import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCategory,
  validateFields,
  validateValues,
  validateRich,
  richText,
  validateNav,
  permission,
  validatePolicy,
} from '../lib/cms-domain.mjs';
test('article and product classification support at most two levels', () => {
  assert.equal(
    validateCategory(
      { kind: 'articles', nameZh: 'a', nameEn: 'A', parentId: 'p' },
      [{ id: 'p', kind: 'articles', parent_id: null }],
    ).parentId,
    'p',
  );
  assert.throws(() =>
    validateCategory(
      { kind: 'products', nameZh: 'a', nameEn: 'A', parentId: 'p' },
      [{ id: 'p', kind: 'products', parent_id: 'root' }],
    ),
  );
  assert.equal(
    validateCategory(
      { kind: 'products', nameZh: 'a', nameEn: 'A', parentId: 'p' },
      [{ id: 'p', kind: 'products', parent_id: null }],
    ).parentId,
    'p',
  );
});
test('fields require stable unique ids and supported types', () => {
  assert.throws(() => validateFields([{ id: 'x', type: 'script' }]));
  assert.throws(() =>
    validateFields([
      { id: 'x', type: 'text', labelZh: 'x', labelEn: 'x' },
      { id: 'x', type: 'text', labelZh: 'x', labelEn: 'x' },
    ]),
  );
});
test('dynamic field validation checks email, date, numeric range and required values', () => {
  for (const [type, value] of [
    ['email', 'bad'],
    ['date', '2026-02-30'],
    ['number', 'abc'],
    ['time', '25:00'],
    ['phone', 'hello'],
  ])
    assert.throws(() =>
      validateValues(
        [{ id: 'x', type, labelZh: 'x', labelEn: 'x', required: true }],
        { x: value },
      ),
    );
  assert.equal(
    validateValues(
      [
        {
          id: 'x',
          type: 'number',
          labelZh: 'x',
          labelEn: 'x',
          required: true,
          min: 1,
          max: 10,
        },
      ],
      { x: '5' },
    ).x,
    5,
  );
  assert.throws(() =>
    validateValues(
      [{ id: 'x', type: 'number', labelZh: 'x', labelEn: 'x', max: 10 }],
      { x: '20' },
    ),
  );
});
test('rich documents reject raw HTML, unsafe links and arbitrary media URLs', () => {
  assert.throws(() => validateRich({ type: 'script' }));
  assert.throws(() =>
    validateRich({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bad',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    }),
  );
  assert.throws(() =>
    validateRich({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://evil.test/a' } }],
    }),
  );
});
test('valid rich content supplies plain text for GEO', () =>
  assert.equal(
    richText(
      validateRich({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        ],
      }),
    ),
    'Hello',
  ));
test('navigation accepts exactly one typed target', () => {
  assert.throws(() =>
    validateNav({
      targetType: 'url',
      targetId: 'x',
      labelZh: 'a',
      labelEn: 'A',
    }),
  );
  assert.equal(
    validateNav({
      targetType: 'article',
      targetId: 'x',
      labelZh: 'a',
      labelEn: 'A',
    }).targetId,
    'x',
  );
});
test('editors cannot manage administrators, policies, settings or private submissions', () => {
  assert.equal(permission('editor', 'saveContent'), true);
  for (const a of [
    'saveAdmin',
    'savePolicy',
    'saveSettings',
    'readSubmissions',
    'updateSubmission',
    'exportSubmissions',
    'markSubmission',
    'readUsers',
  ])
    assert.equal(permission('editor', a), false);
  assert.equal(permission('owner', 'saveAdmin'), true);
  assert.equal(permission('disabled', 'saveContent'), false);
});
test('policy publishing needs both languages', () => {
  assert.throws(() =>
    validatePolicy({
      kind: 'privacy',
      titleZh: 'a',
      titleEn: 'A',
      bodyZh: 'abc',
      bodyEn: '',
      status: 'published',
    }),
  );
});

test('rich validation retains spaces across formatting boundaries', () => {
  const doc = validateRich({
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
  });
  assert.equal(richText(doc), 'Hello world');
});
