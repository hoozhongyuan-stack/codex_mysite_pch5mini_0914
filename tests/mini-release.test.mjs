import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import {
  buildMiniCiArgs,
  resolveMiniProjectPath,
  buildSubmitAuditPayload,
  maskAppId,
  sanitizeMiniCiOutput,
  validateMiniReleaseInput,
  saveMiniReleaseKey,
  miniReleaseStatus,
  prepareMiniCiWorkDir,
  runProcess,
  miniCiFailureMessage,
} from '../lib/mini-release.mjs';

test('mini release runs compiler in a private writable directory outside the application root', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mini-ci-work-'));
  t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(root, { recursive: true, force: true }); });
  const workDir = await prepareMiniCiWorkDir(path.join(root, 'output'));
  assert.equal(workDir, path.join(root, 'output', 'work'));
  assert.equal((await stat(workDir)).mode & 0o777, 0o700);
  const result = await runProcess(process.execPath, ['-e', 'process.stdout.write(process.cwd())'], {
    cwd: workDir,
    timeoutMs: 5000,
    secrets: [],
  });
  assert.equal(result.code, 0);
  assert.equal(result.stdout, await realpath(workDir));
});

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

test('mini release explains compiler directory permission errors without showing stack traces', () => {
  assert.equal(
    miniCiFailureMessage('Error: EACCES: permission denied, mkdir /app/hash'),
    '小程序编译目录不可写，请检查服务器发布工作目录权限。',
  );
  assert.equal(miniCiFailureMessage('network timeout'), '执行失败');
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

test('owner-uploaded key stays private and enables a matching project', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mini-release-test-'));
  t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(root, { recursive: true, force: true }); });
  const project = path.join(root, 'project');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(project);
  await writeFile(path.join(project, 'project.config.json'), JSON.stringify({ appid: 'wx0607272189f69483' }));
  const env = { MINI_RELEASE_PRIVATE_DIR: path.join(root, 'private'), MINI_CI_PROJECT_PATH: project, WECHAT_MINI_APPID: 'wx0607272189f69483', MINI_RELEASE_RECORDS: path.join(root, 'records.json') };
  const key = Buffer.from(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }));
  await assert.rejects(saveMiniReleaseKey(Buffer.from('not a key'), env), /密钥文件/);
  await saveMiniReleaseKey(key, env);
  const keyPath = path.join(root, 'private', 'wechat-upload.key');
  assert.equal((await stat(keyPath)).mode & 0o777, 0o600);
  assert.equal((await readFile(keyPath, 'utf8')).trim(), key.toString().trim());
  assert.equal((await miniReleaseStatus(env)).configured, true);
  assert.equal((await miniReleaseStatus({ ...env, WECHAT_MINI_APPID: 'wx1234567890123456' })).configured, false);
});
