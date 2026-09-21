'use client';
import Link from '../../components/site-link';
import { useEffect, useState } from 'react';
import { marketingApi, Pager } from './marketing-shared';
import SalonDetail from './salon-detail';
import { useAdminDetail, useAdminSearch, navigateAdmin } from './admin-navigation';
import { AdminDetailState, AdminPageHeader } from './admin-ui';
import './marketing-workspace.css';
import { CalendarDays, ArrowLeft, Film, ClipboardList, Gift } from 'lucide-react';
import { Field, Choice } from './shared';
import RichEditor from './rich-editor';
import FormBuilder from './form-builder';
import AssetPicker from './asset-picker';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  AdminFormActions,
  useDialogChangeRevision,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './admin-dialog';
const statuses = [
  ['draft', '草稿'],
  ['published', '已发布'],
  ['closed', '关闭报名'],
  ['cancelled', '已取消'],
  ['archived', '已归档'],
];
const dates: any = {
  starts: '活动开始',
  ends: '活动结束',
  registrationStarts: '报名开始',
  registrationEnds: '报名截止',
  checkinStarts: '签到开始',
  checkinEnds: '签到截止',
  cancelEnds: '取消截止',
};
const newEvent = () => {
  const date = (days: number, hours: number) =>
    new Date(Date.now() + days * 86400000 + hours * 3600000).toISOString();
  return {
    titleZh: '',
    titleEn: '',
    timezone: 'Asia/Shanghai',
    status: 'draft',
    capacity: null,
    allowCancel: true,
    test: false,
    starts: date(7, 0),
    ends: date(7, 3),
    registrationStarts: date(0, 0),
    registrationEnds: date(6, 0),
    checkinStarts: date(6, 23),
    checkinEnds: date(7, 2),
    cancelEnds: date(6, 0),
    fields: [
      {
        id: 'name',
        type: 'text',
        labelZh: '姓名',
        labelEn: 'Name',
        required: true,
      },
      {
        id: 'email',
        type: 'email',
        labelZh: '邮箱',
        labelEn: 'Email',
        required: true,
      },
      {
        id: 'phone',
        type: 'phone',
        labelZh: '手机号',
        labelEn: 'Phone',
        required: false,
      },
      {
        id: 'company',
        type: 'text',
        labelZh: '公司',
        labelEn: 'Company',
        required: false,
      },
    ],
  };
};
export default function Marketing({ data }: any) {
  const can = (permission: string) => data.user.role === 'owner' || data.user.permissions?.includes('marketing.' + permission) === true;
  const [result, setResult] = useState<any>({ rows: [] }),
    [filters, setFilters] = useState({
      q: '',
      status: '',
      from: '',
      to: '',
      page: 1,
      pageSize: 20,
    }),
    [edit, setEdit] = useState<any>(null),
    [picker, setPicker] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [batchResults, setBatchResults] = useState<any[]>([]);
  const search = useAdminSearch();
  const entered = !!(new URLSearchParams(search).get('salons') || new URLSearchParams(search).get('salon'));
  const detailRoute = useAdminDetail<any>('salon', id => marketingApi('admin-detail', {id}));
  const detail = detailRoute.value;
  const setDetail = detailRoute.setValue;
  const reload = async () => {
    setResult(await marketingApi('admin-list', filters));
    setSelected([]);
  };
  useEffect(() => {
    if (entered) reload().catch((e) => setError(e.message));
  }, [entered, filters]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  async function batch(operation: string) {
    const labels: Record<string,string> = {publish:'发布',unpublish:'下架并转草稿',delete:'永久删除',export:'导出'};
    if (!selected.length || busy || !can(operation==='export'?'export':'manage')) return;
    if (operation !== 'export' && !window.confirm(`确认${labels[operation]}选中的 ${selected.length} 个活动？${operation==='delete'?'仅无报名及操作历史的草稿可删除，删除不可恢复。':''}`)) return;
    await run(async () => {
      const response = await marketingApi('admin-batch-events', {selected, operation}, true);
      setBatchResults(response.results || []);
      if (operation === 'export' && response.rows?.length) {
        const csv = (value: any) => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""') + '"';
        const rows = [['ID','中文名称','英文名称','状态','开始时间','结束时间','地点'], ...response.rows.map((row: any) => [row.id,row.titleZh,row.titleEn,statuses.find(x=>x[0]===row.status)?.[1]||row.status,row.starts,row.ends,row.locationZh])];
        const url = URL.createObjectURL(new Blob(['\ufeff'+rows.map((row:any[])=>row.map(csv).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}));
        const link = document.createElement('a'); link.href=url; link.download='沙龙活动.csv'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      if (operation !== 'export') await reload();
    });
  }
  const [editRevision, markEdited] = useDialogChangeRevision();
  const set = (k: string, v: any) => { markEdited(); setEdit((s: any) => ({ ...s, [k]: v })); };
  if (!entered)
    return (
      <section className="marketing-workspace">
        <div className="section-head">
          <h1>营销中心</h1>
        </div>
        <div className="marketing-activity-grid">
          {data.user.role === 'owner' && (
            <> <Link prefetch={false} className="panel marketing-activity" href="/admin?view=pointsMall"><Gift size={32}/><h2>积分商城</h2><p>管理兑换商品、积分及订单</p><b>进入管理 →</b></Link>
            <Link prefetch={false}
              className="panel marketing-activity"
              href="/admin?view=videoSeries"
            >
              <Film size={32} />
              <h2>视频专栏</h2>
              <p>短剧、课程、分集更新与观看统计</p>
              <b>进入管理 →</b>
            </Link></>
          )}
          <div className="panel marketing-activity">
            <ClipboardList size={32} />
            <h2>表单活动</h2>
            <p>创建报名、咨询与信息收集表单</p>
            <div className="flex-actions">
              <Link prefetch={false} className="btn" href="/admin?view=forms">
                表单管理
              </Link>
              {data.user.role === 'owner' && (
                <Link prefetch={false} className="btn" href="/admin?view=submissions">
                  提交记录
                </Link>
              )}
            </div>
          </div>
          {can('view') && (
            <button
              className="panel marketing-activity"
              onClick={() => navigateAdmin({salons:'1'})}
            >
              <CalendarDays size={32} />
              <h2>沙龙会</h2>
              <p>发布活动、管理报名与签到</p>
              <b>进入管理 →</b>
            </button>
          )}
        </div>
      </section>
    );
  if (detailRoute.loading || detailRoute.error) return <AdminDetailState loading={detailRoute.loading} error={detailRoute.error} onBack={detailRoute.close} onRetry={detailRoute.retry}/>;
  if (detail)
    return (
      <SalonDetail
        detail={detail}
        role={data.user.role}
        permissions={data.user.permissions || []}
        onBack={() => {
          detailRoute.close();
          reload().catch((e) => setError(e.message));
        }}
        onReload={async () =>
          setDetail(await marketingApi('admin-detail', { id: detail.event.id }))
        }
      />
    );
  return (
    <section className="marketing-workspace">
      <AdminPageHeader title="沙龙会" onBack={()=>navigateAdmin({salons:'',salon:'',salonTab:''})} backLabel="营销中心" actions={can('manage')&&<button className="btn primary" onClick={() => setEdit(newEvent())}>新建活动</button>}/>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        className="admin-filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          reload().catch((e) => setError(e.message));
        }}
      >
        <Field
          label="活动名称"
          value={filters.q}
          onChange={(q: string) => setFilters({ ...filters, q, page: 1 })}
        />
        <Choice
          label="状态"
          value={filters.status || 'all'}
          items={[['all', '全部'], ...statuses]}
          onChange={(s: string) =>
            setFilters({ ...filters, status: s === 'all' ? '' : s, page: 1 })
          }
        />
        <Field
          label="举办时间起"
          type="datetime-local"
          value={
            filters.from
              ? new Date(
                  Date.parse(filters.from) -
                    new Date(filters.from).getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : ''
          }
          onChange={(v: string) =>
            setFilters({
              ...filters,
              from: v ? new Date(v).toISOString() : '',
              page: 1,
            })
          }
        />
        <Field
          label="举办时间止（不含）"
          type="datetime-local"
          value={
            filters.to
              ? new Date(
                  Date.parse(filters.to) -
                    new Date(filters.to).getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : ''
          }
          onChange={(v: string) =>
            setFilters({
              ...filters,
              to: v ? new Date(v).toISOString() : '',
              page: 1,
            })
          }
        />
        <Choice
          label="每页"
          value={String(filters.pageSize)}
          items={['20', '50', '100'].map((v) => [v, v + '条'])}
          onChange={(v: string) =>
            setFilters({ ...filters, pageSize: Number(v), page: 1 })
          }
        />
        <button className="btn">查询</button>
      </form>
      <div className="salon-batch-toolbar flex-actions">
        <span>已选 {selected.length} 项（当前页）</span>
        {[['publish','批量发布'],['unpublish','批量下架'],['export','导出选中'],['delete','删除草稿']].filter(([operation])=>can(operation==='export'?'export':'manage')).map(([operation,label])=><button aria-busy={Boolean(busy)} key={operation} className="btn" disabled={busy||!selected.length} onClick={()=>batch(operation)}>{label}</button>)}
      </div>
      {batchResults.length>0&&<div className="notice" role="status"><p>成功 {batchResults.filter(x=>x.ok).length} 项；失败 {batchResults.filter(x=>!x.ok).length} 项</p>{batchResults.filter(x=>!x.ok).map(x=><p key={x.id}>{result.rows.find((r:any)=>r.id===x.id)?.titleZh||x.id}：{x.error}</p>)}</div>}
      <div className="panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><input type="checkbox" aria-label="选择当前页全部活动" disabled={busy||!result.rows.length} checked={result.rows.length>0&&result.rows.every((row:any)=>selected.includes(row.id))} onChange={e=>setSelected(e.target.checked?result.rows.map((row:any)=>row.id):[])}/></TableHead>
              {['活动', '举办时间', '状态', '操作'].map((x) => (
                <TableHead key={x}>{x}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((event: any) => (
              <TableRow key={event.id}>
                <TableCell><input type="checkbox" aria-label={'选择活动 '+event.titleZh} disabled={busy} checked={selected.includes(event.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,event.id]:old.filter(id=>id!==event.id))}/></TableCell>
                <TableCell>
                  <b>{event.titleZh}</b>
                  {event.test && <span className="pill">测试</span>}
                </TableCell>
                <TableCell>
                  {new Date(event.starts).toLocaleString('zh-CN', {
                    timeZone: event.timezone,
                  })}
                </TableCell>
                <TableCell>
                  {statuses.find((x) => x[0] === event.status)?.[1]}
                </TableCell>
                <TableCell>
                  <div className="flex-actions">
                    {can('manage')&&<button
                      className="btn"
                      onClick={() =>
                        run(async () => {
                          const d = await marketingApi('admin-detail', {
                            id: event.id,
                          });
                          setEdit({ ...event, affected: d.stats.valid });
                        })
                      }
                    >
                      编辑
                    </button>}
                    <button
                      className="btn"
                      onClick={() =>
                        detailRoute.open(event.id)
                      }
                    >
                      报名与统计
                    </button>
                    {can('manage')&&<button
                      className="btn"
                      onClick={() =>
                        setEdit({
                          ...event,
                          id: undefined,
                          status: 'draft',
                          titleZh: event.titleZh + '（副本）',
                        })
                      }
                    >
                      复制
                    </button>}
                    <Link prefetch={false} className="btn" href={'/zh/events/' + event.id}>
                      查看前台
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pager
          result={result}
          onPage={(page: number) => setFilters({ ...filters, page })}
        />
      </div>
      {edit && can('manage') && (
        <Dialog changeRevision={editRevision} open onOpenChange={(o) => !o && !busy && setEdit(null)}>
          <DialogContent
            size="editor"
          >
            <DialogHeader>
              <DialogTitle>{edit.id ? '编辑活动' : '新建活动'}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await marketingApi('admin-save', edit, true);
                  setEdit(null);
                  await reload();
                });
              }}
            >
              {error && <p role="alert" className="error">{error}</p>}
              <div className="field-grid">
                {[
                  ['titleZh', '中文名称'],
                  ['titleEn', '英文名称'],
                  ['summaryZh', '中文摘要'],
                  ['summaryEn', '英文摘要'],
                  ['organizer', '主办方'],
                  ['contact', '联系人'],
                  ['phone', '联系电话'],
                  ['locationZh', '中文地点'],
                  ['locationEn', '英文地点'],
                  ['addressZh', '中文地址'],
                  ['addressEn', '英文地址'],
                ].map(([k, l]) => (
                  <Field
                    key={k}
                    label={l}
                    required={k === 'titleZh'}
                    value={edit[k]}
                    maxLength={k.includes('summary') ? 1000 : 200}
                    onChange={(v: string) => set(k, v)}
                  />
                ))}
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => setPicker(true)}
              >
                选择封面
              </button>
              {edit.imageId && (
                <img
                  src={'/api/media/' + edit.imageId}
                  alt="封面"
                  style={{ width: 150, margin: 12 }}
                />
              )}
              <p className="muted">
                下方时间按此设备时区输入；保存后换算为绝对时间。活动展示使用所选时区。
              </p>
              <Field
                label="活动展示时区"
                value={edit.timezone}
                onChange={(v: string) => set('timezone', v)}
              />
              <div className="field-grid">
                {Object.entries(dates).map(([k, l]) => (
                  <Field
                    key={k}
                    label={l}
                    type="datetime-local"
                    required
                    value={new Date(
                      new Date(edit[k]).getTime() -
                        new Date(edit[k]).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)}
                    onChange={(v: string) => {
                      if (v) set(k, new Date(v).toISOString());
                    }}
                  />
                ))}
              </div>
              <Field
                label="人数上限（留空不限）"
                type="number"
                value={edit.capacity ?? ''}
                onChange={(v: string) =>
                  set('capacity', v === '' ? null : Number(v))
                }
              />
              <Choice
                label="活动状态"
                items={statuses}
                value={edit.status}
                onChange={(v: string) => set('status', v)}
              />
              <div className="flex-actions">
                {[
                  ['allowCancel', '允许用户取消报名'],
                  ['notify', '保存时通知已报名用户重要变更'],
                ].map(([k, l]) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={!!edit[k]}
                      onChange={(e) => set(k, e.target.checked)}
                    />
                    {l}
                  </label>
                ))}
              </div>
              {edit.id && (
                <p role="status" className="notice">
                  当前有效报名 {edit.affected ?? '—'}{' '}
                  人。修改时间、地点或取消活动会影响这些用户，请核实上方通知选项。
                </p>
              )}
              <h3>中文详情</h3>
              <RichEditor
                value={edit.bodyZh}
                onChange={(v: any) => set('bodyZh', v)}
                assets={data.assets}
                folders={data.folders}
              />
              <h3>英文详情</h3>
              <RichEditor
                value={edit.bodyEn}
                onChange={(v: any) => set('bodyEn', v)}
                assets={data.assets}
                folders={data.folders}
              />
              <FormBuilder
                fields={edit.fields}
                onChange={(v: any) => set('fields', v)}
              />
              <AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
                {busy ? '保存中…' : '保存活动'}
              </button></AdminFormActions>
            </form>
            {picker && (
              <AssetPicker
                assets={data.assets}
                folders={data.folders}
                accept="image"
                onSelect={(a: any) => {
                  set('imageId', a.id);
                  setPicker(false);
                }}
                onClose={() => setPicker(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
