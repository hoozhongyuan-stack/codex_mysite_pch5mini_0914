'use client';
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
export function Pager({ result, onPage }: any) {
  return (
    <div className="flex-actions" style={{ padding: 16 }}>
      共 {result.total || 0} 条{' '}
      <button
        className="btn"
        disabled={result.page <= 1}
        onClick={() => onPage(result.page - 1)}
      >
        上一页
      </button>
      {result.page || 1} / {result.pages || 1}
      <button
        className="btn"
        disabled={result.page >= result.pages}
        onClick={() => onPage(result.page + 1)}
      >
        下一页
      </button>
    </div>
  );
}
