'use client';
import { AdminPagination } from './admin-ui';
export async function marketingApi(
  action: string,
  data: any = {},
  write = false,
) {
  const r = await fetch(
    '/api/marketing/' + action + (write ? '' : '?' + new URLSearchParams(data)),
    write
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : undefined,
  );
  const d = (await r.json()) as any;
  if (!r.ok) throw Error(d.error || '请求失败');
  return d;
}
export function Pager({ result, onPage, busy = false }: any) {
  return <AdminPagination total={result.total || 0} page={result.page || 1} pages={result.pages || 1} onPage={onPage} busy={busy}/>;
}
