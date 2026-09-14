import {responseData} from './response.mjs';
import Taro from '@tarojs/taro';
import { navigation, assetUrl } from './domain.mjs';
export const origin = MINI_API_ORIGIN;
export const image = (id?: string) => assetUrl(origin, id);
const sessionKey = 'mini-session-v1:' + origin;
export const saveSession = (value: string) =>
  Taro.setStorageSync(sessionKey, value);
export const clearSession = () => Taro.removeStorageSync(sessionKey);
export const token = () => Taro.getStorageSync(sessionKey) || '';
export async function request(path: string, data?: any, expectedSession?: string) {
  if (!origin) throw Error('服务地址尚未配置，请联系管理员');
  const session=token();
  if(expectedSession!==undefined&&session!==expectedSession)throw Error('登录状态已变化，请重试');
  const r = await Taro.request({
    url: origin + path,
    method: data === undefined ? 'GET' : 'POST',
    data,
    dataType: 'json',
    responseType: 'text',
    header: {
      ...(session ? { Authorization: 'Bearer ' + session } : {}),
      'Content-Type': 'application/json',
    },
    timeout: 12000,
  });
  if(expectedSession!==undefined&&token()!==expectedSession)throw Error('登录状态已变化，请重试');
  if (r.statusCode === 401 && token()===session) clearSession();
  const body = responseData(r.data);
  if (r.statusCode < 200 || r.statusCode >= 300)
    throw Object.assign(Error(body.error || '暂时无法读取，请稍后重试'),{status:r.statusCode});
  return body;
}
const cacheKey = 'mini-layout-v1:' + origin;
export async function configuration() {
  try {
    const data = await request('/api/channel-config?end=mini&lang=zh');
    if (!data.mini) {
      Taro.removeStorageSync(cacheKey);
      return { data: null, cached: false };
    }
    navigation(data.mini.navigation);
    if (
      !Array.isArray(data.mini.banners) ||
      !Array.isArray(data.mini.featuredIds)
    )
      throw Error('首页配置无效');
    Taro.setStorageSync(cacheKey, { ...data, floating: [] });
    return { data, cached: false };
  } catch (e) {
    const cached = Taro.getStorageSync(cacheKey);
    if (cached?.mini) {
      navigation(cached.mini.navigation);
      return { data: cached, cached: true };
    }
    throw e;
  }
}

export async function upload(path: string, fields: Record<string, string>) {
  const session = token();
  if (!origin || !session) throw Error('请先登录');
  const selected = await Taro.chooseMedia({
    count: 1,
    mediaType: ['image'],
    sizeType: ['compressed'],
  });
  if (token() !== session) throw Error('账号已变更，请重新上传');
  if (selected.tempFiles[0].size > 5 * 1024 * 1024)
    throw Error('图片限5MB以内');
  const result = await Taro.uploadFile({
    url: origin + path,
    filePath: selected.tempFiles[0].tempFilePath,
    name: 'file',
    formData: fields,
    header: { Authorization: 'Bearer ' + session },
  });
  if (token() !== session) throw Error('账号已变更，请重新上传');
  const data = JSON.parse(result.data);
  if (result.statusCode < 200 || result.statusCode >= 300)
    throw Error(data.error || '上传失败');
  return data;
}

export async function privateImage(path: string) {
  const r = await Taro.downloadFile({
    url: origin + path,
    header: { Authorization: 'Bearer ' + token() },
  });
  if (r.statusCode !== 200) throw Error('图片读取失败，请重新登录后重试');
  await Taro.previewImage({ urls: [r.tempFilePath] });
}
