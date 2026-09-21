'use client';
import SiteLink from '../../components/site-link';

import { useState, useEffect } from 'react';
import './collections-compact.css';
import { categoryParentOptions, categoryTreeRows, categoryEditDraft } from '@/lib/category-editor.mjs';
import {
  Dialog,
  AdminFormActions,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './admin-dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Field, Choice, mutate } from './shared';
const names: any = {
  articleCategories: '文章分类',
  productCategories: '商品分类',
  folders: '素材文件夹',
  navigation: '导航管理',
  admins: '管理员',
};
export default function Collections({ view, data, reload }: any) {
  const [navQuery, setNavQuery] = useState(''),
    [navType, setNavType] = useState(''),
    [navState, setNavState] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    if (view === 'navigation')
      fetch('/api/marketing/list?pageSize=100')
        .then((r) => r.json())
        .then((d: any) => setEvents(d.rows || []))
        .catch(() => setEvents([]));
  }, [view]);
  const [edit, setEdit] = useState<any>(null),
    [remove, setRemove] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const category = view.endsWith('Categories'),
    folder = view === 'folders',
    nav = view === 'navigation',
    accounts = view === 'admins';
  const kind = view === 'articleCategories' ? 'articles' : 'products';
  const rows = category
    ? categoryTreeRows(data.categories, kind, collapsed)
    : folder
      ? data.folders
      : nav
        ? [...data.navigation].sort((a: any, b: any) => a.sort - b.sort)
        : data.admins;
  const action = category
    ? 'Category'
    : folder
      ? 'Folder'
      : nav
        ? 'Nav'
        : 'Admin';
  const set = (k: string, v: any) => setEdit((s: any) => ({ ...s, [k]: v }));
  const fresh = () =>
    setEdit(
      category
        ? { kind, nameZh: '', nameEn: '', parentId: '' }
        : folder
          ? { name: '' }
          : nav
            ? {
                labelZh: '',
                labelEn: '',
                targetType: 'articleCategory',
                targetId: '',
                sort: 0,
                enabled: true,
              }
            : { email: '', name: '', role: 'editor', status: 'active' },
    );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await mutate('save' + action, { data: edit });
      await reload();
      setEdit(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function del() {
    setBusy(true);
    try {
      await mutate('delete' + action, { id: remove.id });
      await reload();
      setRemove(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const targets =
    edit?.targetType === 'pointsMall' ? [['points-shop','积分商城']] : edit?.targetType === 'videoCatalog' ? [['videos','全部视频系列']] : edit?.targetType === 'event'
      ? events.map((e: any) => [e.id, e.titleZh])
      : edit?.targetType?.endsWith('Category')
        ? data.categories
            .filter(
              (c: any) =>
                c.kind ===
                (edit.targetType === 'articleCategory'
                  ? 'articles'
                  : 'products'),
            )
            .map((c: any) => [c.id, c.nameZh])
        : data.contents
            .filter(
              (c: any) =>
                c.kind ===
                (
                  {
                    article: 'articles',
                    product: 'products',
                    form: 'forms',
                  } as any
                )[edit?.targetType],
            )
            .map((c: any) => [
              c.id,
              c.titleZh + (c.status === 'draft' ? '（草稿）' : ''),
            ]);
  const navTarget = (r: any) => {
    if(r.targetType==='pointsMall')return {target:{id:'points-shop'},title:'积分商城',available:true,href:'/zh/points-shop'};
    if(r.targetType==='videoCatalog')return {target:{id:'videos'},title:'全部视频系列',available:true,href:'/zh/videos'};
    const isCat = r.targetType.endsWith('Category');
    const target = (
      isCat
        ? data.categories
        : r.targetType === 'event'
          ? events
          : data.contents
    ).find((x: any) => x.id === r.targetId);
    const available = !!target && (isCat || target.status === 'published');
    return {
      target,
      title: isCat && target?.parent_id ? (data.categories.find((c:any)=>c.id===target.parent_id)?.nameZh||'')+' / '+target.nameZh : target?.nameZh||target?.titleZh,
      available,
      href: target
        ? `/zh/${isCat ? 'categories/' + target.id : r.targetType === 'event' ? 'events/' + target.id : target.kind + '/' + target.slug}`
        : '',
    };
  };
  const quickSave = async (r: any) => {
    setBusy(true);
    try {
      await mutate('saveNav', { data: r });
      await reload();
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="heading-row">
        <div>
          <h1>{names[view]}</h1>
          <p className="muted">
            {category
              ? kind === 'articles'
                ? '文章分类最多两级，可展开查看子分类。'
                : '商品分类最多两级，可将商品放入一级或二级分类。'
              : folder
                ? '删除文件夹后，素材会归入未分类。'
                : nav
                  ? '每项导航关联一个目标；目标未发布时不在前台显示。'
                  : '子账号通过其 ChatGPT 账号登录，还需获得站点访问授权。'}
          </p>
        </div>
        <button className="btn primary" onClick={fresh}>
          ＋ 新增
        </button>
      </div>
      {accounts && (
        <div role="status" className="notice">
          主账号：leohoo@petalmail.com、hopezhongyuan@gmail.com。主账号始终保留管理权限。编辑员仅可管理内容、分类和素材。
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {nav && (
        <div className="catalog-toolbar nav-filters">
          <label>
            导航名称
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="中文 / English"
            />
          </label>
          <label>
            关联类型
            <select
              value={navType}
              onChange={(e) => setNavType(e.target.value)}
            >
              <option value="">全部类型</option>
              {Object.entries({
                articleCategory: '文章分类',
                productCategory: '商品分类',
                article: '文章',
                product: '商品',
                form: '表单',
                pointsMall:'积分商城', videoCatalog:'视频专栏', event: '沙龙会',
              }).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            显示状态
            <select
              value={navState}
              onChange={(e) => setNavState(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="on">显示</option>
              <option value="off">隐藏</option>
            </select>
          </label>
          <button
            className="btn"
            onClick={() => {
              setNavQuery('');
              setNavType('');
              setNavState('');
            }}
          >
            重置
          </button>
        </div>
      )}
      <section className={'panel collections-panel' + (nav ? ' navigation-panel' : ' category-panel')}>
        <Table>
          <TableHeader>
            <TableRow>
              {nav && <TableHead>排序</TableHead>}
              <TableHead>名称</TableHead>
              <TableHead>
                {category
                  ? '上级分类'
                  : nav
                    ? '关联类型'
                    : accounts
                      ? '权限 / 状态'
                      : '文件夹'}
              </TableHead>
              {nav && (
                <>
                  <TableHead>关联目标</TableHead>
                  <TableHead>显示状态</TableHead>
                </>
              )}
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows
              .filter(
                (r: any) =>
                  !nav ||
                  ((!navQuery ||
                    (r.labelZh + ' ' + r.labelEn)
                      .toLowerCase()
                      .includes(navQuery.toLowerCase())) &&
                    (!navType || r.targetType === navType) &&
                    (!navState || r.enabled === (navState === 'on'))),
              )
              .map((r: any) => (
                <TableRow
                  key={r.id || r.email}
                  className={
                    category
                      ? r.parent_id
                        ? 'category-child'
                        : 'category-parent'
                      : ''
                  }
                >
                  {nav && (
                    <TableCell>
                      <input
                        key={r.id + ':' + r.sort}
                        aria-label={'排序 ' + r.labelZh}
                        className="nav-sort"
                        type="number"
                        min="0"
                        max="9999"
                        defaultValue={r.sort}
                        disabled={busy}
                        onBlur={(e) => {
                          const sort = Number(e.target.value);
                          if (
                            sort !== r.sort &&
                            Number.isInteger(sort) &&
                            sort >= 0 &&
                            sort <= 9999
                          )
                            quickSave({ ...r, sort });
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell
                    className={category ? 'category-name-cell' : undefined}
                  >
                    {category && !r.parent_id && (
                      <button
                        className="category-toggle"
                        aria-label={'展开或收起 ' + r.nameZh + ' 子分类'}
                        aria-expanded={!collapsed.includes(r.id)}
                        onClick={() =>
                          setCollapsed((v) =>
                            v.includes(r.id)
                              ? v.filter((id) => id !== r.id)
                              : [...v, r.id],
                          )
                        }
                      >
                        {collapsed.includes(r.id) ? '▸' : '▾'}
                      </button>
                    )}
                    <span style={{ marginLeft: r.parent_id ? 32 : 0 }}>
                      {r.parent_id ? '└ ' : ''}
                      {r.nameZh || r.labelZh || r.name}
                    </span>
                    {category && (
                      <span className="pill gray">
                        {r.parent_id ? '二级' : '一级'}
                      </span>
                    )}
                    <p className="muted">{r.nameEn || r.labelEn || r.email}</p>
                  </TableCell>
                  <TableCell>
                    {category
                      ? data.categories.find((c: any) => c.id === r.parent_id)
                          ?.nameZh || '一级分类'
                      : nav
                        ? `${({ articleCategory: '文章分类', productCategory: '商品分类', article: '文章', product: '商品', form: '表单', pointsMall:'积分商城', videoCatalog:'视频专栏', event: '沙龙会' } as any)[r.targetType]}`
                        : accounts
                          ? `${r.role === 'owner' ? '管理员' : '编辑员'} / ${r.status === 'active' ? '启用' : '停用'}`
                          : '一级文件夹'}
                  </TableCell>
                  {nav && (
                    <>
                      <TableCell>
                        <strong>
                          {navTarget(r).title ||
                            '目标不存在'}
                        </strong>
                        <p className="muted nav-target-path">
                          {navTarget(r).href || r.targetId}
                        </p>
                        {!navTarget(r).available && (
                          <span className="pill">
                            目标未发布或不存在，前台不显示
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <button aria-busy={Boolean(busy)}
                          disabled={busy}
                          className={'btn ' + (r.enabled ? 'nav-visible' : '')}
                          onClick={() =>
                            quickSave({ ...r, enabled: !r.enabled })
                          }
                        >
                          {r.enabled ? '显示' : '隐藏'}
                        </button>
                      </TableCell>
                    </>
                  )}
                  <TableCell>
                    <div className="flex-actions">
                      {nav && navTarget(r).available && (
                        <SiteLink
                          className="btn"
                          target="_blank"
                          rel="noreferrer"
                          href={navTarget(r).href}
                        >
                          预览
                        </SiteLink>
                      )}
                      {category && !r.parent_id && (
                        <button
                          className="btn"
                          onClick={() =>
                            setEdit({
                              kind,
                              nameZh: '',
                              nameEn: '',
                              parentId: r.id,
                            })
                          }
                        >
                          新增二级分类
                        </button>
                      )}
                      <button
                        className="btn"
                        onClick={() =>
                          setEdit(category ? categoryEditDraft(r) : { ...r })
                        }
                      >
                        编辑
                      </button>
                      {!accounts && (
                        <button className="btn" onClick={() => setRemove(r)}>
                          删除
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {!rows.length && (
          <div className="empty-state">暂无记录，点击新增开始配置。</div>
        )}
      </section>
      <Dialog open={!!edit} onOpenChange={(o) => !o && !busy && setEdit(null)}>
        <DialogContent size={category || folder ? 'sm' : 'md'} className={'collections-dialog ' + (category ? 'category-dialog' : nav ? 'navigation-dialog' : 'collection-basic-dialog')}>
          <DialogHeader>
            <DialogTitle>
              {names[view]} · {edit?.id || edit?.email ? '编辑' : '新增'}
            </DialogTitle>
            <DialogDescription>
              保存后立即生效，已有内容关联会保留。
            </DialogDescription>
          </DialogHeader>
          {edit && (
            <form className="collection-editor" onSubmit={save}>
              {category ? (
                <>
                  <Field
                    label="中文名称"
                    value={edit.nameZh}
                    onChange={(v: string) => set('nameZh', v)}
                    required
                  />
                  <Field
                    label="英文名称"
                    value={edit.nameEn}
                    onChange={(v: string) => set('nameEn', v)}
                    required
                  />
                  {category && (
                    <Choice
                      label="上级分类"
                      value={edit.parentId || ''}
                      onChange={(v: string) => set('parentId', v)}
                      items={categoryParentOptions(data.categories, kind, edit.id)}
                    />
                  )}
                </>
              ) : folder ? (
                <Field
                  label="文件夹名称"
                  value={edit.name}
                  onChange={(v: string) => set('name', v)}
                  required
                />
              ) : nav ? (
                <>
                  <div className="field-grid">
                    <Field
                      label="中文导航名"
                      value={edit.labelZh}
                      onChange={(v: string) => set('labelZh', v)}
                      required
                    />
                    <Field
                      label="英文导航名"
                      value={edit.labelEn}
                      onChange={(v: string) => set('labelEn', v)}
                      required
                    />
                  </div>
                  <Choice
                    label="关联类型"
                    required
                    value={edit.targetType}
                    onChange={(v: string) =>
                      setEdit({ ...edit, targetType: v, targetId: '' })
                    }
                    items={[
                      ['articleCategory', '文章分类'],
                      ['productCategory', '商品分类'],
                      ['article', '文章'],
                      ['product', '商品'],
                      ['form', '表单'],
                      ['event', '沙龙会'],
                      ['videoCatalog','视频专栏'], ['pointsMall','系统页面 · 积分商城'],
                    ]}
                  />
                  <Choice
                    label="关联目标"
                    required
                    value={edit.targetId}
                    onChange={(v: string) => set('targetId', v)}
                    items={targets}
                  />
                  <Field
                    label="排序（小的在前）"
                    value={edit.sort}
                    type="number"
                    onChange={(v: string) => set('sort', v)}
                  />
                  <Choice
                    label="显示状态"
                    value={edit.enabled ? 'yes' : 'no'}
                    onChange={(v: string) => set('enabled', v === 'yes')}
                    items={[
                      ['yes', '显示'],
                      ['no', '隐藏'],
                    ]}
                  />
                </>
              ) : (
                <>
                  <Field
                    label="登录邮箱"
                    value={edit.email}
                    type="email"
                    onChange={(v: string) => set('email', v)}
                    required
                  />
                  <Field
                    label="名称"
                    value={edit.name}
                    onChange={(v: string) => set('name', v)}
                    required
                  />
                  <Choice
                    label="权限"
                    value={edit.role}
                    onChange={(v: string) => set('role', v)}
                    items={[
                      ['editor', '编辑员：内容与素材'],
                      ['owner', '管理员：全部后台功能'],
                    ]}
                  />
                  <Choice
                    label="状态"
                    value={edit.status}
                    onChange={(v: string) => set('status', v)}
                    items={[
                      ['active', '启用'],
                      ['disabled', '停用'],
                    ]}
                  />
                </>
              )}
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
                {busy ? '保存中…' : '保存'}
              </button></AdminFormActions>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!remove}
        onOpenChange={(o) => !o && !busy && setRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              {folder
                ? '文件夹将删除，里面的素材归入未分类。'
                : '被内容、子分类或导航引用的分类无法删除。该操作不可撤销。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className="error">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={del}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
