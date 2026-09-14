import { identity } from './identity';
import { HttpError } from './server';
import { miniToken } from './mini-business.mjs';
export function bearer(request: Request) {
  try {
    return miniToken(request.headers.get('authorization'));
  } catch {
    throw new HttpError(401, '请先登录小程序');
  }
}
export async function miniBuyer(request: Request) {
  const session = bearer(request),
    result = await identity('session', { session });
  if (!result.user || result.user.sandbox)
    throw new HttpError(401, '登录已过期，请重新登录');
  return { user: result.user, session };
}
