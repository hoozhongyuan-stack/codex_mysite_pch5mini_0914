'use client';
import { useState, useEffect, useCallback } from 'react';
import { AdminPagination } from './admin-ui';
export type Filter = {
  key: string;
  label: string;
  type?: string;
  options?: [string, string][];
};
export function useList(endpoint: string) {
  const initial = () =>
    typeof window === 'undefined'
      ? ''
      : new URLSearchParams(window.location.search).toString();
  const [query, setQuery] = useState(initial),
    [version, setVersion] = useState(0),
    [result, setResult] = useState<any>({
      rows: [],
      total: 0,
      page: 1,
      pages: 1,
      size: 20,
    }),
    [resultEndpoint, setResultEndpoint] = useState(endpoint),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const reload = useCallback(async () => {
    setVersion((v) => v + 1);
  }, []);
  const update = (values: Record<string, string>) => {
    const p = new URLSearchParams(query);
    if(Object.hasOwn(values,'from')||Object.hasOwn(values,'to'))for(const key of ['dashboard','start','end','dataMode'])p.delete(key);
    for (const [k, v] of Object.entries(values)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const next = p.toString();
    window.history.pushState(window.history.state, '', window.location.pathname + '?' + next);
    window.dispatchEvent(new Event('admin:navigate'));
    setQuery(next);
  };
  useEffect(() => {
    const pop = () => setQuery(initial());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(endpoint + (endpoint.includes('?') ? '&' : '?') + query, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error || '加载失败');
        if(controller.signal.aborted)return;
        setResult(d);
        setResultEndpoint(endpoint);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, query, version]);
  return { query, result:resultEndpoint===endpoint?result:{rows:[],total:0,page:1,pages:1,size:20}, loading:loading||(resultEndpoint!==endpoint&&!error), error, update, reload };
}
export function Filters({
  list,
  fields,
}: {
  list: ReturnType<typeof useList>;
  fields: Filter[];
}) {
  const p = new URLSearchParams(list.query);
  const renderFields = (items: Filter[]) => (<>      {items.map((f) => (
        <label key={f.key}>
          <span>{f.label}</span>
          {f.options ? (
            <select name={f.key} defaultValue={p.get(f.key) || ''}>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={f.key}
              type={f.type || 'search'}
              maxLength={200}
              defaultValue={p.get(f.key) || ''}
            />
          )}
        </label>
      ))}
</>);
  return (
    <form
      className="list-filters"
      key={list.query}
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        list.update({
          ...(Object.fromEntries(d) as Record<string, string>),
          page: '1',
        });
      }}
    >
      {renderFields(fields.slice(0, 3))}
      <details className="admin-filter-more" open={fields.slice(3).some(f => p.get(f.key)) || !!p.get('from') || !!p.get('to') || undefined}>
        <summary>更多筛选{fields.slice(3).some(f => p.get(f.key)) || p.get('from') || p.get('to') ? ' · 已设置' : ''}</summary>
        <div>{renderFields(fields.slice(3))}
      <label>
        <span>开始日期（UTC）</span>
        <input type="date" name="from" defaultValue={p.get('from') || ''} />
      </label>
      <label>
        <span>结束日期（UTC）</span>
        <input type="date" name="to" defaultValue={p.get('to') || ''} />
      </label>
      <label>
        <span>时间排序</span>
        <select name="sort" defaultValue={p.get('sort') || 'desc'}>
          <option value="desc">最新在前</option>
          <option value="asc">最早在前</option>
        </select>
      </label>
        </div>
      </details>
      <div className="admin-filter-actions">
      <button aria-busy={Boolean(list.loading)} className="btn primary" disabled={list.loading}>
        查询
      </button>
      <button
        className="btn"
        type="button"
        onClick={() =>
          list.update(
            Object.fromEntries([
              ...fields.map((f) => [f.key, '']),
              ['from', ''],
              ['to', ''],
              ['sort', ''],
              ['page', '1'],
            ]),
          )
        }
      >
        重置
      </button>
      </div>
    </form>
  );
}
export function Pager({ list }: { list: ReturnType<typeof useList> }) {
  const r = list.result;
  return (
    <AdminPagination total={r.total} page={r.page} pages={r.pages} busy={list.loading} onPage={(page)=>list.update({page:String(page)})}>
      <select
        aria-label="每页条数"
        value={new URLSearchParams(list.query).get('size') || 20}
        onChange={(e) => list.update({ size: e.target.value, page: '1' })}
      >
        {[20, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n} 条/页
          </option>
        ))}
      </select>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          list.update({
            page: String(new FormData(e.currentTarget).get('page')),
          });
        }}
      >
        <input
          aria-label="跳转页码"
          name="page"
          type="number"
          min={1}
          max={r.pages}
          defaultValue={r.page}
          key={r.page}
          required
        />
        <button aria-busy={Boolean(list.loading)} className="btn" disabled={list.loading}>
          跳转
        </button>
      </form>
    </AdminPagination>
  );
}
export function ListState({ list }: { list: ReturnType<typeof useList> }) {
  return (
    <>
      {list.loading ? (
        <p className="empty-state" role="status">
          {list.result.rows.length ? '正在更新，当前显示上次结果…' : '正在加载…'}
        </p>
      ) : list.error ? (
        <p role="alert" className="error">
          {list.error}
          <button className="btn" onClick={list.reload}>
            重试
          </button>
        </p>
      ) : !list.result.rows.length ? (
        <p className="empty-state">没有符合条件的记录</p>
      ) : null}
    </>
  );
}
export function useSelection(query: string) {
  const [selected, set] = useState<string[]>([]);
  useEffect(() => set([]), [query]);
  return {
    selected,
    clear: () => set([]),
    toggle: (id: string) =>
      set((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id])),
    all: (ids: string[]) =>
      set((s) => (ids.every((id) => s.includes(id)) ? [] : ids)),
  };
}
export function SelectAll({
  selection,
  rows,
}: {
  selection: ReturnType<typeof useSelection>;
  rows: any[];
}) {
  return (
    <input
      aria-label="选择本页全部"
      type="checkbox"
      checked={
        !!rows.length &&
        rows.every((r) => selection.selected.includes(String(r.id)))
      }
      onChange={() => selection.all(rows.map((r) => String(r.id)))}
    />
  );
}
