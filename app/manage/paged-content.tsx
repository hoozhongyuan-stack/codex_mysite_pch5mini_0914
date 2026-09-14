'use client';
import SiteLink from '../../components/site-link';

import { useState } from 'react';
import Editor from './editor';
import { priceLabel } from '@/lib/product-options.mjs';
import ProductStockSummary from './product-stock-summary';
import { mutate } from './shared';
import {
  useList,
  Filters,
  Pager,
  ListState,
  useSelection,
  SelectAll,
} from './list-ui';
export default function PagedContent({ kind, data, reload }: any) {
  const list = useList('/api/admin/list?kind=' + kind),
    selection = useSelection(
      list.query + JSON.stringify(list.result.rows.map((r: any) => r.id)),
    ),
    [edit, setEdit] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [failedRecords, setFailedRecords] = useState<any[]>([]);
  const rows = list.result.rows,
    labels: any = { articles: '文章', products: '商品', forms: '表单' };
  const refresh = async () => {
    await list.reload();
    await reload();
  };
  async function act(records: any[], action: string) {
    if (!records.length) return;
    if (
      action === 'delete' &&
      !window.confirm(
        `确认删除 ${records.length} 条内容？删除后不可恢复，导航引用的内容将跳过。`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    setFailedRecords([]);
    const failed: any[] = [];
    let count = 0;
    const errors = [];
    let refreshError = '';
    for (const record of records) {
      try {
        await mutate(
          action === 'delete' ? 'deleteContent' : 'saveContent',
          action === 'delete'
            ? { id: record.id }
            : { expectedUpdatedAt: record.updatedAt, data: { ...record, status: action } },
        );
        count++;
      } catch (e) {
        errors.push(`${record.titleZh}：${(e as Error).message}`);
        failed.push(record);
      }
    }
    setFailedRecords(failed);
    selection.clear();
    try {
      await refresh();
    } catch (e) {
      refreshError = '刷新列表失败：' + (e as Error).message;
    }
    setMessage(
      `成功 ${count} 条；失败 ${errors.length} 条${errors.length ? '\n' + errors.join('\n') : ''}${refreshError ? '\n' + refreshError : ''}`,
    );
    setBusy(false);
  }
  const categories = data.categories.filter((c: any) => c.kind === kind);
  return (
    <>
      {new URLSearchParams(list.query).get('lowStock')==='1'&&<p role="status" className="notice">低库存筛选：已发布且已知库存≤5的商品（多规格任一启用规格）。<SiteLink href="/admin?view=products">清除库存筛选</SiteLink></p>}
      <div className="heading-row">
        <h1>{labels[kind]}管理</h1>
        <button
          className="btn primary"
          onClick={() =>
            setEdit({
              kind,
              status: 'draft',
              slug: '',
              titleZh: '',
              titleEn: '',
            })
          }
        >
          创建{labels[kind]}
        </button>
      </div>
      {message && (
        <div role="status" className="notice" style={{ whiteSpace: 'pre-wrap' }}>
          <p>{message}</p>
          {!!failedRecords.length && <div className="flex-actions">
            {failedRecords.map((record: any) => <button className="btn" key={record.id} onClick={() => setEdit(rows.find((r: any) => r.id === record.id) || record)}>编辑：{record.titleZh}</button>)}
          </div>}
        </div>
      )}
      <section className="panel">
        <Filters
          list={list}
          fields={[
            { key: 'q', label: '标题 / 链接 / SPU' },
            {
              key: 'status',
              label: '发布状态',
              options: [
                ['', '全部'],
                ['draft', '草稿'],
                ['published', '已发布'],
              ],
            },
            ...(kind === 'forms'
              ? []
              : [
                  {
                    key: 'category',
                    label:
                      kind === 'products' ? '分类（含子分类）' : '文章分类',
                    options: [
                      ['', '全部'],
                      ...categories.map((c: any) => [
                        c.id,
                        (c.parent_id ? '└ ' : '') + c.nameZh,
                      ]),
                    ] as [string, string][],
                  },
                ]),
          ]}
        />
        <div className="list-batch">
          <span>已选 {selection.selected.length} 条（当前页）</span>
          {[
            ['published', '批量发布'],
            ['draft', '批量下架'],
            ['delete', '批量删除'],
          ].map(([a, l]) => (
            <button aria-busy={Boolean(busy)}
              className="btn"
              key={a}
              disabled={busy || list.loading || !selection.selected.length}
              onClick={() =>
                act(
                  rows.filter((r: any) => selection.selected.includes(r.id)),
                  a,
                )
              }
            >
              {l}
            </button>
          ))}
        </div>
        <div className="list-table-wrap" aria-busy={list.loading} inert={list.loading}>
          <table className="list-table">
            <thead>
              <tr>
                <th>
                  <SelectAll selection={selection} rows={rows} />
                </th>
                <th>标题</th>
                <th>分类</th>{kind === 'products' && <><th>价格</th><th>可售库存</th></>}
                <th>语言</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.loading && !rows.length && Array.from({length:5},(_,i)=><tr key={'loading-'+i} aria-hidden="true"><td colSpan={kind==='products'?9:7}><div className="list-skeleton-line"/></td></tr>)}
              {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        aria-label={'选择 ' + r.titleZh}
                        type="checkbox"
                        disabled={list.loading}
                        checked={selection.selected.includes(r.id)}
                        onChange={() => selection.toggle(r.id)}
                      />
                    </td>
                    <td>
                      <button className="title-link" onClick={() => setEdit(r)}>
                        {r.titleZh}
                      </button>
                      <small className="muted">{kind === 'products' ? (r.spu ? 'SPU：' + r.spu : '未设置编码') : '/' + r.slug}</small>

                    </td>
                    <td>
                      {categories.find((c: any) => c.id === r.categoryId)
                        ?.nameZh || '未分类'}
                    </td>
                    {kind === 'products' && <><td>{r.trade ? priceLabel(r.trade,'') : '待填写'}</td><td><ProductStockSummary record={r}/></td></>}
                    <td>中文 {r.titleEn ? ' / EN' : ''}</td>
                    <td>
                      <span
                        className={
                          'pill ' +
                          (r.status === 'published' ? 'green' : 'gray')
                        }
                      >
                        {r.status === 'published' ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td>{new Date(r.updatedAt).toLocaleString('zh-CN')}</td>
                    <td>
                      <div className="flex-actions">
                        <button className="btn" onClick={() => setEdit(r)}>
                          编辑
                        </button>
                        {kind === 'forms' && data.user.role === 'owner' && <SiteLink className="btn" href={'/admin?view=submissions&form='+encodeURIComponent(r.id)}>提交记录</SiteLink>}
                        {kind !== 'forms' && (
                          <SiteLink
                            className="btn"
                            target="_blank"
                            rel="noreferrer"
                            href={'/preview/' + r.id}
                          >
                            预览
                          </SiteLink>
                        )}
                        {r.status === 'published' && (
                          <SiteLink
                            className="btn"
                            target="_blank"
                            rel="noreferrer"
                            href={`/zh/${kind}/${r.slug}`}
                          >
                            查看
                          </SiteLink>
                        )}
                        <button aria-busy={Boolean(busy)}
                          className="btn"
                          disabled={busy || list.loading}
                          onClick={() =>
                            act(
                              [r],
                              r.status === 'published' ? 'draft' : 'published',
                            )
                          }
                        >
                          {r.status === 'published' ? '下架' : '发布'}
                        </button>
                        <button aria-busy={Boolean(busy)}
                          className="btn"
                          disabled={busy || list.loading}
                          onClick={() => act([r], 'delete')}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <ListState list={list} />
        <Pager list={list} />
      </section>
      {edit && (
        <Editor
          record={edit}
          assets={data.assets}
          folders={data.folders}
          categories={data.categories}
          forms={data.contents.filter((r: any) => r.kind === 'forms')}
          onClose={() => setEdit(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
