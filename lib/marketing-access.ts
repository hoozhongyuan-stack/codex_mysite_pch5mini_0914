import { admin, HttpError } from './server';
export async function marketingAccess(permission = 'view') {
  const user = await admin();
  if (user.role === 'owner') return user;
  if (!user.permissions.includes('marketing.' + permission))
    throw new HttpError(403, '没有此营销操作权限');
  return user;
}
