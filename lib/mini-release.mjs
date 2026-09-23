import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_RECORDS_PATH = '/tmp/aition-mini-release-records.json';
const DEFAULT_OUTPUT_DIR = '/tmp/aition-mini-ci';
const MAX_RECORDS = 80;
const MAX_OUTPUT_CHARS = 5000;
const MAX_PROCESS_OUTPUT_CHARS = 64 * 1024;
const MINI_CI_PACKAGE = 'miniprogram-ci@2.1.31';
let miniCiProcessActive = false;

function envValue(env, key) {
  return typeof env?.[key] === 'string' ? env[key].trim() : '';
}


export function candidateMiniProjectPaths(cwd = process.cwd()) {
  return [
    path.join(cwd, 'miniapp', 'dist'),
    path.join(cwd, '..', 'miniapp', 'dist'),
    path.join(cwd, '..', '..', 'miniapp', 'dist'),
  ].map((item) => path.resolve(item));
}

export function resolveMiniProjectPath(rawEnv = process.env) {
  const explicit = envValue(rawEnv, 'MINI_CI_PROJECT_PATH');
  if (explicit) return path.resolve(explicit);
  const [first, ...rest] = candidateMiniProjectPaths(process.cwd());
  return [first, ...rest].find((item) => existsSync(item)) || first;
}

export function maskAppId(appid = '') {
  if (!appid) return '';
  if (appid.length <= 10) return appid.slice(0, 3) + '***';
  return appid.slice(0, 6) + '***' + appid.slice(-4);
}

export function sanitizeMiniCiOutput(text = '', secrets = []) {
  let cleaned = String(text || '');
  for (const secret of secrets.filter(Boolean)) {
    cleaned = cleaned.split(secret).join('[hidden]');
  }
  cleaned = cleaned.replace(/privateKeyPath\s*[:=]\s*[^\s,}]+/gi, 'privateKeyPath=[hidden]');
  cleaned = cleaned.replace(/("privateKey"\s*:\s*")[^"]+("?)/gi, '$1[hidden]$2');
  if (cleaned.length > MAX_OUTPUT_CHARS) {
    cleaned = cleaned.slice(0, MAX_OUTPUT_CHARS) + '\n…输出过长，已截断';
  }
  return cleaned;
}

export function validateMiniReleaseInput(input = {}) {
  const action = String(input.action || '').trim();
  if (!['preview', 'upload', 'submitAudit'].includes(action)) throw Error('操作无效');
  const version = String(input.version || '').trim();
  if (!version || version.length > 32) throw Error('版本号需填写，且不超过32个字符');
  const desc = String(input.desc || '').trim();
  if (!desc || desc.length > 120) throw Error('版本说明需填写，且不超过120个字符');
  if (action === 'submitAudit') return { action, version, desc, audit: validateAuditInput(input.audit || {}) };
  return { action, version, desc };
}

export async function readMiniProjectAppId(projectPath = resolveMiniProjectPath()) {
  try {
    const raw = await readFile(path.join(projectPath, 'project.config.json'), 'utf8');
    const data = JSON.parse(raw);
    return typeof data.appid === 'string' ? data.appid.trim() : '';
  } catch {
    return '';
  }
}

export async function miniReleaseStatus(rawEnv = process.env) {
  const projectPath = resolveMiniProjectPath(rawEnv);
  const outputDir = envValue(rawEnv, 'MINI_CI_OUTPUT_DIR') || DEFAULT_OUTPUT_DIR;
  const recordsPath = envValue(rawEnv, 'MINI_RELEASE_RECORDS') || DEFAULT_RECORDS_PATH;
  const appid = envValue(rawEnv, 'WECHAT_MINI_APPID') || envValue(rawEnv, 'MINI_APPID') || await readMiniProjectAppId(projectPath);
  const privateKeyPath = envValue(rawEnv, 'WECHAT_MINI_UPLOAD_KEY_PATH') || envValue(rawEnv, 'MINI_UPLOAD_KEY_PATH');
  const robotRaw = envValue(rawEnv, 'WECHAT_MINI_CI_ROBOT') || envValue(rawEnv, 'MINI_CI_ROBOT') || '1';
  const robot = Number.parseInt(robotRaw, 10);
  const projectExists = existsSync(projectPath);
  const privateKeyExists = Boolean(privateKeyPath && existsSync(privateKeyPath));
  const configured = Boolean(appid && projectExists && privateKeyExists);
  return {
    configured,
    appidMasked: maskAppId(appid),
    projectPath,
    projectExists,
    privateKeyConfigured: Boolean(privateKeyPath),
    privateKeyExists,
    robot: Number.isFinite(robot) && robot > 0 ? robot : 1,
    outputDir,
    recordsPath,
    records: await readMiniReleaseRecords(recordsPath),
    tokenConfigured: Boolean(envValue(rawEnv, 'WECHAT_MINI_ACCESS_TOKEN')),
    actions: {
      preview: configured,
      upload: configured,
      submitAudit: Boolean(envValue(rawEnv, 'WECHAT_MINI_ACCESS_TOKEN')),
      release: false,
    },
  };
}

export function validateAuditInput(input = {}) {
  const item = {
    address: String(input.address || '').trim(),
    title: String(input.title || '').trim(),
    tag: String(input.tag || '').trim(),
    first_class: String(input.first_class || '').trim(),
    second_class: String(input.second_class || '').trim(),
    third_class: String(input.third_class || '').trim(),
    first_id: Number.parseInt(String(input.first_id || ''), 10),
    second_id: Number.parseInt(String(input.second_id || ''), 10),
    third_id: input.third_id === '' || input.third_id == null ? undefined : Number.parseInt(String(input.third_id), 10),
  };
  if (!item.address || item.address.length > 128) throw Error('审核页面路径需填写，且不超过128个字符');
  if (!item.title || item.title.length > 32) throw Error('审核页面标题需填写，且不超过32个字符');
  if (!item.tag || item.tag.length > 200) throw Error('审核标签需填写，且不超过200个字符');
  if (!item.first_class || !Number.isFinite(item.first_id)) throw Error('审核一级类目名称和ID需填写');
  if (!item.second_class || !Number.isFinite(item.second_id)) throw Error('审核二级类目名称和ID需填写');
  if (item.third_class && !Number.isFinite(item.third_id)) throw Error('审核三级类目填写名称时也需要填写ID');
  const clean = {
    address: item.address,
    title: item.title,
    tag: item.tag,
    first_class: item.first_class,
    second_class: item.second_class,
    first_id: item.first_id,
    second_id: item.second_id,
  };
  if (item.third_class) {
    clean.third_class = item.third_class;
    clean.third_id = item.third_id;
  }
  return clean;
}

export function buildSubmitAuditPayload(audit) {
  return { item_list: [validateAuditInput(audit)] };
}

export function buildMiniCiArgs({ action, projectPath, privateKeyPath, appid, version, desc, robot, qrcodePath }) {
  const base = [
    '--yes',
    MINI_CI_PACKAGE,
    action,
    '--pp', projectPath,
    '--pkp', privateKeyPath,
    '--appid', appid,
    '--uv', version,
    '--ud', desc,
    '--enable-es6', 'true',
    '--robot', String(robot || 1),
  ];
  if (action === 'preview') {
    base.push('--qrcode-format', 'image', '--qrcode-output-dest', qrcodePath);
  }
  return base;
}

export async function readMiniReleaseRecords(recordsPath = DEFAULT_RECORDS_PATH) {
  try {
    const raw = await readFile(recordsPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.slice(0, MAX_RECORDS) : [];
  } catch {
    return [];
  }
}

async function writeMiniReleaseRecords(records, recordsPath = DEFAULT_RECORDS_PATH) {
  await mkdir(path.dirname(recordsPath), { recursive: true });
  await writeFile(recordsPath, JSON.stringify(records.slice(0, MAX_RECORDS), null, 2));
}

async function appendRecord(record, recordsPath) {
  const current = await readMiniReleaseRecords(recordsPath);
  const next = [record, ...current.filter((row) => row.id !== record.id)].slice(0, MAX_RECORDS);
  await writeMiniReleaseRecords(next, recordsPath);
  return next;
}

async function runProcess(command, args, { timeoutMs, secrets }) {
  if (miniCiProcessActive) {
    return { code: -1, timedOut: false, stdout: '', stderr: '已有小程序发布任务正在执行，请稍后重试。' };
  }
  miniCiProcessActive = true;
  try {
    return await new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout = (stdout + chunk.toString()).slice(-MAX_PROCESS_OUTPUT_CHARS); });
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-MAX_PROCESS_OUTPUT_CHARS); });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: -1, timedOut, stdout: '', stderr: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code: typeof code === 'number' ? code : -1,
        timedOut,
        stdout: sanitizeMiniCiOutput(stdout, secrets),
        stderr: sanitizeMiniCiOutput(stderr, secrets),
      });
    });
    });
  } finally {
    miniCiProcessActive = false;
  }
}

export async function runMiniRelease(input, rawEnv = process.env) {
  const checked = validateMiniReleaseInput(input);
  const status = await miniReleaseStatus(rawEnv);
  if (checked.action === 'submitAudit') return submitMiniAudit(checked, status, rawEnv);
  if (!status.configured) {
    throw Error('小程序上传环境未配置完整：需要 AppID、已构建小程序目录和微信代码上传密钥文件。');
  }
  const appid = envValue(rawEnv, 'WECHAT_MINI_APPID') || envValue(rawEnv, 'MINI_APPID') || await readMiniProjectAppId(status.projectPath);
  const privateKeyPath = envValue(rawEnv, 'WECHAT_MINI_UPLOAD_KEY_PATH') || envValue(rawEnv, 'MINI_UPLOAD_KEY_PATH');
  const id = crypto.randomUUID();
  await mkdir(status.outputDir, { recursive: true });
  const qrcodePath = path.join(status.outputDir, `${id}.jpg`);
  const record = {
    id,
    action: checked.action,
    version: checked.version,
    desc: checked.desc,
    status: 'running',
    createdAt: new Date().toISOString(),
    finishedAt: '',
    appidMasked: maskAppId(appid),
    message: '正在执行微信小程序 CI',
    stdout: '',
    stderr: '',
    qrcode: false,
  };
  await appendRecord(record, status.recordsPath);
  const args = buildMiniCiArgs({
    action: checked.action,
    projectPath: status.projectPath,
    privateKeyPath,
    appid,
    version: checked.version,
    desc: checked.desc,
    robot: status.robot,
    qrcodePath,
  });
  const result = await runProcess('npx', args, {
    timeoutMs: 8 * 60 * 1000,
    secrets: [privateKeyPath, appid],
  });
  const ok = result.code === 0 && !result.timedOut;
  const finished = {
    ...record,
    status: ok ? 'success' : 'failed',
    finishedAt: new Date().toISOString(),
    message: result.timedOut ? '执行超时，请到服务器检查微信 CI 输出' : ok ? '执行成功' : '执行失败',
    stdout: result.stdout,
    stderr: result.stderr,
    qrcode: checked.action === 'preview' && existsSync(qrcodePath),
  };
  const records = await appendRecord(finished, status.recordsPath);
  let qrcodeDataUrl = '';
  if (finished.qrcode) {
    const img = await readFile(qrcodePath);
    qrcodeDataUrl = `data:image/jpeg;base64,${img.toString('base64')}`;
  }
  return { ok, record: finished, records, qrcodeDataUrl };
}


async function submitMiniAudit(checked, status, rawEnv) {
  const accessToken = envValue(rawEnv, 'WECHAT_MINI_ACCESS_TOKEN');
  if (!accessToken) throw Error('服务器未配置 WECHAT_MINI_ACCESS_TOKEN，不能提交微信审核。');
  const id = crypto.randomUUID();
  const record = {
    id,
    action: 'submitAudit',
    version: checked.version,
    desc: checked.desc,
    status: 'running',
    createdAt: new Date().toISOString(),
    finishedAt: '',
    appidMasked: status.appidMasked,
    message: '正在提交微信审核',
    auditId: '',
    stdout: '',
    stderr: '',
    qrcode: false,
  };
  await appendRecord(record, status.recordsPath);
  const payload = buildSubmitAuditPayload(checked.audit);
  let responseJson = null;
  let ok = false;
  let message = '';
  try {
    const response = await fetch(`https://api.weixin.qq.com/wxa/submit_audit?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    responseJson = await response.json().catch(() => null);
    ok = response.ok && responseJson?.errcode === 0;
    message = ok ? '已提交微信审核' : `微信审核提交失败：${responseJson?.errmsg || response.statusText}`;
  } catch (error) {
    message = `微信审核提交失败：${error instanceof Error ? error.message : 'network error'}`;
  }
  const finished = {
    ...record,
    status: ok ? 'success' : 'failed',
    finishedAt: new Date().toISOString(),
    message,
    auditId: responseJson?.auditid ? String(responseJson.auditid) : '',
    stdout: responseJson ? sanitizeMiniCiOutput(JSON.stringify({ ...responseJson, access_token: undefined }), [accessToken]) : '',
  };
  const records = await appendRecord(finished, status.recordsPath);
  return { ok, record: finished, records, qrcodeDataUrl: '' };
}
