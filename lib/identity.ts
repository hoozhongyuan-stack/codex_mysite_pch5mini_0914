import { env } from 'cloudflare:workers';
import { HttpError } from './server';
export async function identity(action: string, data: any = {}, actor?: string) {
  const config = env as unknown as Record<string, string>;
  if (!config.IDENTITY_URL || !config.IDENTITY_KEY)
    throw new HttpError(503, '邮箱账号服务尚未配置');
  const response = await fetch(config.IDENTITY_URL + '/' + action, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + config.IDENTITY_KEY,
      ...(actor ? { 'X-Admin-Actor': actor } : {}),
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(action === 'oauth-finish' ? 40000 : 20000),
  });
  const result: any = await response.json();
  if (!response.ok)
    throw new HttpError(response.status, result.error || '账号服务暂不可用');
  return result;
}
export function visitorSession(request: Request) {
  return (
    request.headers
      .get('cookie')
      ?.match(/(?:^|;\s*)geo_visitor=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1] || ''
  );
}
