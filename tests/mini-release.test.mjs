import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMiniCiArgs,
  resolveMiniProjectPath,
  buildSubmitAuditPayload,
  maskAppId,
  sanitizeMiniCiOutput,
  validateMiniReleaseInput,
} from '../lib/mini-release.mjs';

test('mini release masks appid for admin display', () => {
  assert.equal(maskAppId('wx0607272189f69483'), 'wx0607***9483');
  assert.equal(maskAppId('wx123'), 'wx1***');
});

test('mini release validates action, version and description', () => {
  assert.deepEqual(validateMiniReleaseInput({ action: 'preview', version: 'V2.8.6', desc: '体验版' }), {
    action: 'preview',
    version: 'V2.8.6',
    desc: '体验版',
  });
  assert.throws(() => validateMiniReleaseInput({ action: 'audit', version: 'V1', desc: 'x' }), /操作无效/);
  assert.throws(() => validateMiniReleaseInput({ action: 'upload', version: '', desc: 'x' }), /版本号/);
  assert.throws(() => validateMiniReleaseInput({ action: 'upload', version: 'V1', desc: '' }), /版本说明/);
});

test('mini release command uses explicit project, key and preview qrcode path', () => {
  const args = buildMiniCiArgs({
    action: 'preview',
    projectPath: '/tmp/project',
    privateKeyPath: '/tmp/key.pem',
    appid: 'wxabc',
    version: 'V2.8.6',
    desc: 'preview build',
    robot: 2,
    qrcodePath: '/tmp/qr.jpg',
  });
  assert.deepEqual(args.slice(0, 3), ['--yes', 'miniprogram-ci@2.1.31', 'preview']);
  assert.ok(args.includes('--pp'));
  assert.ok(args.includes('/tmp/project'));
  assert.ok(args.includes('--pkp'));
  assert.ok(args.includes('/tmp/key.pem'));
  assert.ok(args.includes('--qrcode-output-dest'));
  assert.ok(args.includes('/tmp/qr.jpg'));
});

test('mini release output sanitizer hides sensitive paths and appid', () => {
  const raw = 'appid wxabc privateKeyPath=/tmp/key.pem failed at /tmp/key.pem';
  const cleaned = sanitizeMiniCiOutput(raw, ['/tmp/key.pem', 'wxabc']);
  assert.equal(cleaned.includes('/tmp/key.pem'), false);
  assert.equal(cleaned.includes('wxabc'), false);
  assert.match(cleaned, /\[hidden\]/);
});


test('mini release builds bounded submit audit payload', () => {
  const payload = buildSubmitAuditPayload({
    address: 'pages/index/index',
    title: '首页',
    tag: '品牌 内容 商城',
    first_class: '商家自营',
    first_id: '1',
    second_class: '生活服务',
    second_id: '2',
    third_class: '',
    third_id: '',
  });
  assert.deepEqual(payload, {
    item_list: [{
      address: 'pages/index/index',
      title: '首页',
      tag: '品牌 内容 商城',
      first_class: '商家自营',
      second_class: '生活服务',
      first_id: 1,
      second_id: 2,
    }],
  });
  assert.throws(() => buildSubmitAuditPayload({ address: '', title: '首页' }), /审核页面路径/);
});


test('mini release resolves project path from env when configured', () => {
  assert.equal(resolveMiniProjectPath({ MINI_CI_PROJECT_PATH: '/srv/aition/current/miniapp/dist' }), '/srv/aition/current/miniapp/dist');
});
