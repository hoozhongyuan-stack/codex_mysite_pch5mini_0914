'use client';
import { useAdminTab, useAdminUnsavedChanges } from './admin-navigation';
import { AdminTabs } from './admin-ui';
import SiteLink from '../../components/site-link';

import MiniLinkPicker from './mini-link-picker';
import MiniHotspots from './mini-hotspots';
import MiniLoginSettings from './mini-login-settings';
import './channel-settings.css';
import { useEffect, useState } from 'react';
import { Smartphone, Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Field, Choice } from './shared';
import AssetPicker from './asset-picker';
import { miniTargets, miniReadyTargets, validateMini } from '@/lib/channel-config.mjs';
import { SOFTWARE_VERSION } from '@/lib/app-version';
export default function ChannelSettings({ data, floatingOnly = false }: any) {
  const [state, setState] = useState<any>(null),
    [form, setForm] = useState<any>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState<any>(null),
    [dirty, setDirty] = useState(false);
  const [notificationRecords, setNotificationRecords] = useState<any[]>([]);
  const [releaseState, setReleaseState] = useState<any>(null);
  const [releaseBusy, setReleaseBusy] = useState('');
  const [releaseForm, setReleaseForm] = useState({ version: SOFTWARE_VERSION, desc: '小程序体验版更新' });
  const [auditForm, setAuditForm] = useState({ address: 'pages/index/index', title: '首页', tag: '品牌 内容 商城', first_class: '', first_id: '', second_class: '', second_id: '', third_class: '', third_id: '' });
  const [releaseQr, setReleaseQr] = useState('');
  const [releaseKeyFile, setReleaseKeyFile] = useState<File | null>(null);
  const [tab, setTab] = useAdminTab('miniTab','base',['base','home','micros','nav','notify','release','checks']);
  useAdminUnsavedChanges(dirty, ['miniTab']);
  const load = async () => {
    const r = await fetch('/api/channel-config?admin=1');
    const d: any = await r.json();
    if (!r.ok) throw Error(d.error);
    setState(d);
    setForm(d.draft);
    setDirty(false);
  };
  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);
  useEffect(() => {
    if (tab !== 'notify') return;
    fetch('/api/notification-center')
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        setNotificationRecords(d.records || []);
      })
      .catch((e) => setMessage(e.message));
  }, [tab]);
  const loadReleaseState = async () => {
    const r = await fetch('/api/mini-release');
    const d: any = await r.json();
    if (!r.ok) throw Error(d.error);
    setReleaseState(d);
  };
  useEffect(() => {
    if (tab !== 'release') return;
    loadReleaseState().catch((e) => setMessage(e.message));
  }, [tab]);
  const change = (next: any) => {
    setForm(next);
    setDirty(true);
  };
  const mini = (k: string, v: any) =>
    change({ ...form, mini: { ...form.mini, [k]: v } });
  const rows = (k: string) => (k === 'floating' ? form.floating : form.mini[k]);
  const setRows = (k: string, v: any[]) =>
    k === 'floating' ? change({ ...form, floating: v }) : mini(k, v);
  const update = (k: string, i: number, key: string, value: any) =>
    setRows(
      k,
      rows(k).map((r: any, j: number) =>
        i === j ? { ...r, [key]: value } : r,
      ),
    );
  const navUpdate = (i: number, key: string, value: any) =>
    mini('navigation', {
      ...form.mini.navigation,
      items: form.mini.navigation.items.map((r: any, j: number) =>
        i === j ? { ...r, [key]: value } : r,
      ),
    });
  const controls = (items: any[], set: (v: any[]) => void, i: number) => (
    <div className="flex-actions">
      <button
        className="btn"
        disabled={!i}
        onClick={() =>
          set(
            items.map((r, j) =>
              j === i ? items[i - 1] : j === i - 1 ? items[i] : r,
            ),
          )
        }
        aria-label="上移"
      >
        <ArrowUp size={16} />
      </button>
      <button
        className="btn"
        disabled={i === items.length - 1}
        onClick={() =>
          set(
            items.map((r, j) =>
              j === i ? items[i + 1] : j === i + 1 ? items[i] : r,
            ),
          )
        }
        aria-label="下移"
      >
        <ArrowDown size={16} />
      </button>
      <button
        className="btn"
        onClick={() => set(items.filter((_, j) => j !== i))}
        aria-label="移除"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
  const image = (id: string, apply: (id: string) => void, label: string) => (
    <div className="field">
      <span>{label}</span>
      <div className="flex-actions">
        {id && (
          <img
            src={'/api/media/' + id}
            alt="已选图片"
            style={{ width: 48, height: 48, objectFit: 'contain' }}
          />
        )}
        <button className="btn" onClick={() => setPicker({ apply })}>
          {id ? '更换图片' : '选择图片'}
        </button>
        {id && (
          <button className="btn" onClick={() => apply('')}>
            清除
          </button>
        )}
      </div>
    </div>
  );

  async function runRelease(action: 'preview' | 'upload' | 'submitAudit') {
    setReleaseBusy(action);
    setMessage('');
    setReleaseQr('');
    try {
      const r = await fetch('/api/mini-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...releaseForm, audit: action === 'submitAudit' ? auditForm : undefined }),
      });
      const d: any = await r.json();
      if (!r.ok || !d.ok) throw Error(d.error || d.record?.stderr || d.record?.message || '微信发布操作失败');
      setReleaseState((prev: any) => ({ ...(prev || {}), records: d.records || prev?.records || [] }));
      if (d.qrcodeDataUrl) setReleaseQr(d.qrcodeDataUrl);
      setMessage(action === 'preview' ? '预览码已生成。' : action === 'upload' ? '体验版已上传到微信平台。' : '已提交微信审核。');
      await loadReleaseState();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setReleaseBusy('');
    }
  }

  async function uploadReleaseKey() {
    if (!releaseKeyFile) return;
    setReleaseBusy('key');
    setMessage('');
    try {
      const body = new FormData();
      body.set('key', releaseKeyFile);
      const response = await fetch('/api/mini-release/credential', { method: 'POST', body });
      const result: any = await response.json();
      if (!response.ok) throw Error(result.error || '上传密钥失败');
      setReleaseKeyFile(null);
      await loadReleaseState();
      setMessage('代码上传密钥已保存。');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setReleaseBusy('');
    }
  }

  async function save(action: string) {
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/channel-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          section: floatingOnly ? 'floating' : 'mini',
          revision: state.revision,
          data: form,
        }),
      });
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setState(d);
      setForm(d.draft);
      setDirty(false);
      setMessage(
        action === 'save'
          ? '草稿已保存，前台配置未改变。'
          : action === 'publish'
            ? '配置已发布。'
            : '已恢复上一发布版本。',
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!form) return <div className="panel">{message || '正在读取配置…'}</div>;
  const m = form.mini,
    n = m.navigation;
  const publishedProducts = data.contents.filter((p: any) => p.kind === 'products' && p.status === 'published');
  const componentLabel = (type: string) =>
    type === 'search' ? '搜索框' :
    type === 'notice' ? '公告栏' :
    type === 'divider' ? '辅助线' :
    type === 'banners' ? '轮播图' :
    type === 'hotspots' ? '图片热区' :
    type === 'productFloor' ? '商品楼层' : '页面组件';
  const componentControls = (components: any[], set: (v: any[]) => void) => (
    <div className="mini-component-list">
      <div className="flex-actions mini-component-add">
        <button className="btn" onClick={() => set([...components, { id: crypto.randomUUID(), type: 'search', enabled: true, placeholder: '搜索商品', scope: 'products' }])}>添加搜索框</button>
        <button className="btn" onClick={() => set([...components, { id: crypto.randomUUID(), type: 'notice', enabled: true, text: '请输入公告内容', target: '' }])}>添加公告栏</button>
        <button className="btn" onClick={() => set([...components, { id: crypto.randomUUID(), type: 'divider', enabled: true, style: 'line' }])}>添加辅助线</button>
        <button className="btn" onClick={() => set([...components, { id: crypto.randomUUID(), type: 'banners', enabled: true, items: [] }])}>添加轮播图</button>
        <button className="btn" onClick={() => set([...components, { id: crypto.randomUUID(), type: 'hotspots', enabled: true, items: [] }])}>添加图片热区</button>
        <button className="btn" onClick={() => set([...components, { id: crypto.randomUUID(), type: 'productFloor', enabled: true, title: '精选商品', productIds: [] }])}>添加商品楼层</button>
      </div>
      {!components.length && <p className="mini-empty">尚未添加装修组件。微页面和首页都可添加搜索框、公告栏、辅助线、轮播图、图片热区和商品楼层。</p>}
      {components.map((c: any, i: number) => {
        const updateComponent = (next: any) => set(components.map((row: any, j: number) => (j === i ? next : row)));
        const updateBanner = (index: number, next: any) => updateComponent({ ...c, items: (c.items || []).map((row: any, j: number) => j === index ? next : row) });
        return <div className="footer-config-card mini-component-row" key={c.id || i}>
          <div className="heading-row"><b>{componentLabel(c.type)}</b>{controls(components, set, i)}</div>
          <label><input type="checkbox" checked={c.enabled !== false} onChange={e => updateComponent({ ...c, enabled: e.target.checked })}/> 显示</label>
          {c.type === 'search' ? <div className="field-grid"><Field label="占位文字" value={c.placeholder || '搜索商品'} onChange={(v: string) => updateComponent({ ...c, placeholder: v })}/><Choice label="搜索范围" value={c.scope || 'products'} items={[[ 'products','商品' ],[ 'articles','文章' ],[ 'videos','视频' ],[ 'events','沙龙会' ],[ 'points','积分商品' ]]} onChange={(v: string) => updateComponent({ ...c, scope: v })}/></div> : null}
          {c.type === 'notice' ? <><Field label="公告内容" value={c.text || ''} onChange={(v: string) => updateComponent({ ...c, text: v })}/><MiniLinkPicker value={c} contents={data.contents} microPages={m.microPages || []} onChange={updateComponent}/></> : null}
          {c.type === 'divider' ? <Choice label="样式" value={c.style || 'line'} items={[[ 'line','细线' ],[ 'dashed','虚线' ],[ 'space','留白' ]]} onChange={(v: string) => updateComponent({ ...c, style: v })}/> : null}
          {c.type === 'banners' ? <div className="mini-nested-list">
            <div className="heading-row"><span className="muted">最多5张，发布时每张需选择图片和跳转目标。</span><button className="btn" disabled={(c.items || []).length >= 5} onClick={() => setPicker({ apply: (imageId: string) => updateComponent({ ...c, items: [...(c.items || []), { imageId, title: '', target: 'home' }] }) })}>添加轮播</button></div>
            {(c.items || []).map((b: any, index: number) => <div className="footer-config-card mini-nested-card" key={index}>
              <div className="heading-row"><b>轮播 {index + 1}</b>{controls(c.items || [], (items:any[]) => updateComponent({ ...c, items }), index)}</div>
              {image(b.imageId, (v: string) => updateBanner(index, { ...b, imageId: v }), '轮播图片')}
              <Field label="标题" value={b.title || ''} onChange={(v: string) => updateBanner(index, { ...b, title: v })}/>
              <MiniLinkPicker value={b} contents={data.contents} microPages={m.microPages || []} onChange={(next:any)=>updateBanner(index, next)}/>
            </div>)}
            {!(c.items || []).length && <p className="mini-empty">尚未添加轮播图。</p>}
          </div> : null}
          {c.type === 'hotspots' ? <div className="mini-nested-list"><MiniHotspots items={c.items || []} onChange={(items:any)=>updateComponent({ ...c, items })} selectImage={(apply:any)=>setPicker({apply})} contents={data.contents} microPages={m.microPages || []} onSave={()=>save('save')} busy={busy} message={message}/></div> : null}
          {c.type === 'productFloor' ? <div className="mini-nested-list">
            <Field label="楼层标题" value={c.title || '精选商品'} onChange={(v: string) => updateComponent({ ...c, title: v })}/>
            <p className="muted">选择本组件展示的商品，最多12个。留空时该楼层不展示商品。</p>
            <div className="mini-featured-options compact">
              {publishedProducts.map((p: any) => {
                const selected = (c.productIds || []).includes(p.id);
                return <label key={p.id} style={{ display: 'block', padding: '8px 0' }}><input type="checkbox" checked={selected} onChange={(e)=>{
                  const ids = c.productIds || [];
                  updateComponent({ ...c, productIds: e.target.checked ? [...ids, p.id].slice(0, 12) : ids.filter((id: string) => id !== p.id) });
                }}/> {p.titleZh}</label>;
              })}
            </div>
          </div> : null}
        </div>;
      })}
    </div>
  );
  const microPages = m.microPages || [];
  const setMicroPages = (pages: any[]) => mini('microPages', pages);
  const contentById = new Map(data.contents.map((item: any) => [item.id, item]));
  const productTitle = (product: any) => product?.titleZh || product?.titleEn || product?.title || '未命名商品';
  const productPrice = (product: any) => {
    const price = product?.trade?.price ?? product?.price ?? product?.priceCny;
    return price ? `¥${price}` : '—';
  };
  const previewImage = (imageId?: string) => imageId ? `/api/media/${imageId}` : '';
  const homePreviewComponents = [
    ...((m.homeComponents || []).filter(Boolean)),
    ...(m.banners?.length ? [{ id: 'legacy-banners', type: 'banners', enabled: true, items: m.banners }] : []),
    ...((m.hotspotImages || []).length ? [{ id: 'legacy-hotspots', type: 'hotspots', enabled: true, items: m.hotspotImages }] : []),
    {
      id: 'legacy-products',
      type: 'productFloor',
      enabled: m.productFloor?.enabled !== false,
      title: m.productFloor?.title || '精选商品',
      productIds: m.featuredIds || [],
    },
  ];
  const renderPreviewComponent = (component: any, index: number) => {
    if (component?.enabled === false) return null;
    if (component?.type === 'search') {
      return <div className="mini-preview-search" key={component.id || index}>{component.placeholder || '搜索商品'}</div>;
    }
    if (component?.type === 'notice') {
      return <div className="mini-preview-notice" key={component.id || index}>公告 · {component.text || '请输入公告内容'}</div>;
    }
    if (component?.type === 'divider') {
      return <div className={`mini-preview-divider ${component.style || 'line'}`} key={component.id || index} />;
    }
    if (component?.type === 'banners') {
      const first = (component.items || []).find((item: any) => item.imageId);
      return <div className="mini-preview-banner" key={component.id || index}>{first ? <img src={previewImage(first.imageId)} alt={first.title || '轮播图预览'} /> : <span>轮播图预览</span>}</div>;
    }
    if (component?.type === 'hotspots') {
      const first = (component.items || []).find((item: any) => item.imageId);
      return <div className="mini-preview-hotspot" key={component.id || index}>{first ? <img src={previewImage(first.imageId)} alt="图片热区预览" /> : <span>图片热区预览</span>}<em>{(first?.hotspots || []).length || 0} 个热区</em></div>;
    }
    if (component?.type === 'productFloor') {
      const ids = (component.productIds || []).slice(0, 4);
      const products = ids.map((id: string) => contentById.get(id)).filter(Boolean);
      return <div className="mini-preview-floor" key={component.id || index}>
        <strong>{component.title || '精选商品'}</strong>
        <div>{products.length ? products.map((product: any) => <article key={product.id}><div>{product.imageId ? <img src={previewImage(product.imageId)} alt={productTitle(product)} /> : <span />}</div><b>{productTitle(product)}</b><small>{productPrice(product)}</small></article>) : <p>选择商品后在这里预览</p>}</div>
      </div>;
    }
    return null;
  };
  const MiniPagePreview = ({ title, description, components }: any) => (
    <aside className="mini-builder-preview" aria-label="同页面预览">
      <div className="mini-preview-label">同页面预览</div>
      <div className="mini-phone-frame">
        <div className="mini-phone-top"><span>9:41</span><span>•••</span></div>
        <h3>{title || '页面标题'}</h3>
        {description ? <p className="mini-preview-desc">{description}</p> : null}
        <div className="mini-preview-screen">
          {(components || []).some((item: any) => item?.enabled !== false) ? components.map(renderPreviewComponent) : <div className="mini-preview-empty">添加组件后可在这里实时预览。</div>}
        </div>
      </div>
    </aside>
  );
  return (
    <section className="channel-settings">
      <div className="heading-row">
        <h1>
          <Smartphone size={26} /> {floatingOnly ? '悬浮入口' : '小程序'}
        </h1>
        <div className="flex-actions">
          <button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={() => save('save')}>
            保存草稿
          </button>
          <button aria-busy={Boolean(busy)}
            className="btn primary"
            disabled={busy}
            onClick={() => save('publish')}
          >
            发布配置
          </button>
        </div>
      </div>
      <p className="muted">
        {floatingOnly
          ? 'PC、H5、小程序按端配置，每端最多3个入口。'
          : '商品、订单及积分共用现有后台。'}{' '}
        {dirty ? '有未保存修改。' : ''}
        {!floatingOnly && <span role="status">{!state.published ? '尚未发布：请发布配置后在小程序刷新。' : JSON.stringify(form.mini)!==JSON.stringify(state.published.mini) ? '首页或导航有未发布修改。保存草稿不会改变小程序，请点击发布配置。' : '首页与导航已发布，小程序刷新后读取。'}</span>}
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {!floatingOnly && (
        <AdminTabs label="小程序配置栏目" value={tab} items={[
          ['base','基础配置'],['home','首页装修'],['micros','微页面管理'],['nav','底部导航'],['notify','通知中心'],['release','版本发布'],['checks','版本与检查']
        ]} onChange={setTab}/>
      )}
      <div className="panel" style={{ marginTop: 20 }}>
        {floatingOnly ? (
          <>
            <div className="heading-row">
              <h2>入口列表</h2>
              <button
                className="btn"
                disabled={form.floating.length >= 9}
                onClick={() =>
                  setRows('floating', [
                    ...form.floating,
                    {
                      id: crypto.randomUUID(),
                      labelZh: '联系咨询',
                      labelEn: 'Contact',
                      kind: 'phone',
                      phone: '',
                      icon: 'phone',
                      ends: ['pc', 'h5', 'mini'],
                      pages: [],
                      enabled: false,
                    },
                  ])
                }
              >
                <Plus size={16} />
                新增入口
              </button>
            </div>
            {form.floating.map((e: any, i: number) => (
              <div className="footer-config-card" key={e.id}>
                <div className="heading-row">
                  <b>入口 {i + 1}</b>
                  {controls(form.floating, (v) => setRows('floating', v), i)}
                </div>
                <div className="field-grid">
                  <Field
                    label="中文名称"
                    value={e.labelZh}
                    onChange={(v: string) =>
                      update('floating', i, 'labelZh', v)
                    }
                  />
                  <Field
                    label="英文名称"
                    value={e.labelEn}
                    onChange={(v: string) =>
                      update('floating', i, 'labelEn', v)
                    }
                  />
                  <Choice
                    label="动作"
                    value={e.kind}
                    items={[
                      ['image', '展示图片'],
                      ['phone', '联系电话'],
                      ['form', '填写表单'],
                    ]}
                    onChange={(v: string) => update('floating', i, 'kind', v)}
                  />
                  <Choice
                    label="默认图标"
                    value={e.icon}
                    items={[
                      ['message', '消息'],
                      ['phone', '电话'],
                      ['image', '图片'],
                      ['form', '表单'],
                    ]}
                    onChange={(v: string) => update('floating', i, 'icon', v)}
                  />
                </div>
                {image(
                  e.iconId,
                  (v) => update('floating', i, 'iconId', v),
                  '自定义按钮图标（选填）',
                )}
                {e.kind === 'image' ? (
                  image(
                    e.imageId,
                    (v) => update('floating', i, 'imageId', v),
                    '关联图片（建议1:1，完整展示）',
                  )
                ) : e.kind === 'phone' ? (
                  <Field
                    label="电话号码"
                    value={e.phone}
                    onChange={(v: string) => update('floating', i, 'phone', v)}
                  />
                ) : (
                  <><Choice
                    label="关联已发布表单"
                    value={e.formId || ''}
                    items={data.contents
                      .filter(
                        (r: any) =>
                          r.kind === 'forms' && r.status === 'published',
                      )
                      .map((r: any) => [r.id, r.titleZh])}
                    onChange={(v: string) => update('floating', i, 'formId', v)}
                  />
                  {(() => {
                    const linked = state.formAvailability?.find((f:any) => f.id === e.formId);
                    const missing = e.ends.filter((end:string) => !linked || linked.status !== 'published' || (end === 'mini' ? linked.mini !== 1 : linked.website === 0));
                    return missing.length ? <p role="status" className="notice">此表单在{missing.map((end:string) => end === 'mini' ? '小程序' : end.toUpperCase()).join('、')}不可用，入口会自动隐藏。请在表单编辑中发布内容并开启对应展示渠道。</p> : null;
                  })()}</>
                )}
                <div className="flex-actions">
                  {[
                    ['pc', 'PC'],
                    ['h5', 'H5'],
                    ['mini', '小程序'],
                  ].map(([k, l]) => (
                    <label key={k}>
                      <input
                        type="checkbox"
                        checked={e.ends.includes(k)}
                        onChange={(ev) =>
                          update(
                            'floating',
                            i,
                            'ends',
                            ev.target.checked
                              ? [...e.ends, k]
                              : e.ends.filter((x: string) => x !== k),
                          )
                        }
                      />{' '}
                      {l}
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={e.enabled}
                      onChange={(ev) =>
                        update('floating', i, 'enabled', ev.target.checked)
                      }
                    />{' '}
                    启用
                  </label>
                </div>
                <Field
                  label="指定页面（选填，每行一个路径；留空全站，例如 /products）"
                  multiline
                  value={e.pages.join('\n')}
                  onChange={(v: string) =>
                    update(
                      'floating',
                      i,
                      'pages',
                      v.split('\n').filter(Boolean),
                    )
                  }
                />
              </div>
            ))}
            {!form.floating.length && (
              <p className="muted">尚未配置悬浮入口。</p>
            )}
          </>
        ) : tab === 'base' ? (
          <>
            <h2>基础配置</h2><MiniLoginSettings/><section className="mini-section"><h3>工程连接记录</h3><p className="muted">记录编译时使用的 AppID 和服务域名，用于核对。这里保存不会修改登录密钥，也不会改变已编译小程序的接口地址。</p>
            <div className="field-grid">
              <Field
                label="小程序 AppID"
                value={m.appId}
                onChange={(v: string) => mini('appId', v)}
              />
              <Field
                label="业务接口 HTTPS 域名"
                value={m.apiOrigin}
                onChange={(v: string) => mini('apiOrigin', v)}
              />
            </div>
            <p className="muted">
              工程 AppID 应与上方登录 AppID 一致。域名变更后需重新编译小程序。品牌名称和 Logo 沿用网站设置。
            </p>
            <div className="mini-section-actions"><span>保存到小程序草稿，与首页和导航一同发布。</span><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy} onClick={()=>save('save')}>保存连接记录</button></div></section>
            <SiteLink className="btn" href="/admin?view=floating">
              管理三端悬浮入口
            </SiteLink>
          </>
        ) : tab === 'home' ? (
          <div className="mini-builder-layout">
            <div className="mini-builder-editor">
              <h2>首页内容</h2>
              <div className="field-grid">
                <Field
                  label="首页标题"
                  value={m.title}
                  onChange={(v: string) => mini('title', v)}
                />
                <Field
                  label="简短说明"
                  value={m.description}
                  onChange={(v: string) => mini('description', v)}
                />
              </div>
              <details className="mini-module" open><summary>页面组件 · {(m.homeComponents || []).length}</summary><section className="mini-section">{componentControls(m.homeComponents || [], (v:any[])=>mini('homeComponents',v))}</section></details>
              <details className="mini-module" open><summary>轮播图 · {m.banners.length}/5</summary><section className="mini-section"><div className="heading-row"><h3>轮播图</h3><button className="btn" disabled={m.banners.length>=5} onClick={()=>setPicker({apply:(imageId:string)=>mini('banners',[...m.banners,{title:'',imageId,target:'products'}])})}>添加轮播</button></div>
              {m.banners.map((b: any, i: number) => (
                <div className="footer-config-card" key={i}>
                  {controls(m.banners, (v) => mini('banners', v), i)}
                  {image(
                    b.imageId,
                    (v) => update('banners', i, 'imageId', v),
                    '轮播图片',
                  )}
                  <Field
                    label="标题"
                    value={b.title}
                    onChange={(v: string) => update('banners', i, 'title', v)}
                  />
                  <MiniLinkPicker value={b} contents={data.contents} microPages={m.microPages || []} onChange={(next:any)=>mini('banners',m.banners.map((row:any,j:number)=>i===j?next:row))}/>
                </div>
              ))}
              {!m.banners.length && <p className="mini-empty">尚未添加轮播图。每张图可关联一个目标页面。</p>}</section></details>
              <details className="mini-module" open><summary>图片热区 · {(m.hotspotImages || []).length} 张</summary><MiniHotspots items={m.hotspotImages || []} onChange={(v:any)=>mini('hotspotImages',v)} selectImage={(apply:any)=>setPicker({apply})} contents={data.contents} microPages={m.microPages || []} onSave={()=>save('save')} busy={busy} message={message}/></details>
              <details className="mini-module" open><summary>商品楼层 · {m.productFloor?.enabled !== false ? '显示' : '隐藏'}</summary><section className="mini-section"><div className="mini-product-floor-settings"><div className="mini-switch-panel"><span>展示设置</span><label className="mini-inline-option"><input type="checkbox" checked={m.productFloor?.enabled !== false} onChange={e=>mini('productFloor',{...(m.productFloor||{}),enabled:e.target.checked})}/> 在小程序首页展示商品楼层</label></div><Field label="楼层标题" value={m.productFloor?.title || '精选商品'} onChange={(v:string)=>mini('productFloor',{...(m.productFloor||{}),title:v})}/></div><p className="muted">关闭后不请求或展示首页推荐商品；已发布商品仍可从商城访问。</p></section></details>
              <details className="mini-module"><summary>推荐商品 · {m.featuredIds.length}/12</summary><div className="mini-featured-options">
              {data.contents
                .filter(
                  (p: any) => p.kind === 'products' && p.status === 'published',
                )
                .map((p: any) => (
                  <label
                    key={p.id}
                    style={{ display: 'block', padding: '10px 0' }}
                  >
                    <input
                      type="checkbox"
                      checked={m.featuredIds.includes(p.id)}
                      onChange={(e) =>
                        mini(
                          'featuredIds',
                          e.target.checked
                            ? [...m.featuredIds, p.id]
                            : m.featuredIds.filter((id: string) => id !== p.id),
                        )
                      }
                    />{' '}
                    {p.titleZh}
                  </label>
                ))}</div></details>
            </div>
            <MiniPagePreview title={m.title || '首页'} description={m.description || ''} components={homePreviewComponents}/>
          </div>
        ) : tab === 'micros' ? (
          <>
            <div className="heading-row"><div><h2>微页面管理</h2><p className="muted">微页面复用首页装修组件。发布后的微页面可被底部导航、轮播图和图片热区跳转。</p></div><button className="btn" onClick={() => setMicroPages([...microPages, { id: crypto.randomUUID(), title: '新微页面', description: '', status: 'draft', components: [] }])}>新建微页面</button></div>
            {!microPages.length && <p className="mini-empty">暂无微页面。新建后可配置组件并发布。</p>}
            {microPages.map((page: any, i: number) => {
              const patch = (next: any) => setMicroPages(microPages.map((row: any, j: number) => j === i ? next : row));
              return <details className="mini-module" open key={page.id || i}><summary>{page.title || '未命名微页面'} · {page.status === 'published' ? '已发布' : page.status === 'archived' ? '已下架' : '草稿'}</summary><section className="mini-section mini-builder-layout">
                <div className="mini-builder-editor">
                  <div className="mini-page-toolbar"><b>页面设置</b><div className="flex-actions"><button className="btn" disabled={!i} onClick={() => setMicroPages(microPages.map((row: any, j: number) => j === i ? microPages[i-1] : j === i-1 ? page : row))}>上移</button><button className="btn" onClick={() => setMicroPages([...microPages, { ...page, id: crypto.randomUUID(), title: (page.title || '微页面') + ' 副本', status: 'draft' }])}>复制</button><button className="btn" onClick={() => patch({ ...page, status: page.status === 'published' ? 'archived' : 'published' })}>{page.status === 'published' ? '下架' : '发布'}</button><button className="btn" onClick={() => setMicroPages(microPages.filter((_: any, j: number) => j !== i))}>删除</button></div></div>
                  <div className="field-grid"><Field label="页面标题" value={page.title || ''} onChange={(v: string) => patch({ ...page, title: v })}/><Field label="页面说明" value={page.description || ''} onChange={(v: string) => patch({ ...page, description: v })}/></div>
                  {componentControls(page.components || [], (components:any[]) => patch({ ...page, components }))}
                </div>
                <MiniPagePreview title={page.title || '微页面'} description={page.description || ''} components={page.components || []}/>
              </section></details>;
            })}
          </>
        ) : tab === 'notify' ? (
          <>
            <div className="heading-row"><div><h2>通知中心</h2><p className="muted">第二期先配置微信订阅消息模板、业务触发开关和会员通知记录框架；真实微信发送接入后再写入发送状态。</p></div></div>
            <section className="mini-section">
              <label><input type="checkbox" checked={m.notificationCenter?.enabled === true} onChange={e=>mini('notificationCenter',{...(m.notificationCenter||{}),enabled:e.target.checked})}/> 启用通知中心配置</label>
              <div className="notification-template-grid">
                {[['order','订单通知'],['event','活动通知'],['points','积分通知']].map(([key,label])=>{
                  const current = m.notificationCenter?.templates?.[key] || {};
                  const updateTemplate = (patch:any) => mini('notificationCenter',{...(m.notificationCenter||{}),templates:{...(m.notificationCenter?.templates||{}),[key]:{...current,...patch}}});
                  return <div className="footer-config-card" key={key}>
                    <div className="heading-row"><b>{label}</b><label><input type="checkbox" checked={current.enabled === true} onChange={e=>updateTemplate({enabled:e.target.checked})}/> 启用</label></div>
                    <Field label="微信订阅消息模板ID" value={current.templateId || ''} onChange={(v:string)=>updateTemplate({templateId:v})}/>
                    <Field label="备注" value={current.note || ''} onChange={(v:string)=>updateTemplate({note:v})}/>
                  </div>;
                })}
              </div>
            </section>
            <section className="mini-section">
              <h3>触发场景</h3>
              <div className="notification-trigger-grid">
                {[['orderPaid','订单支付/提交后'],['orderShipped','订单发货后'],['eventRegistered','沙龙会报名后'],['eventChanged','沙龙会变更时'],['pointsChanged','积分变动时']].map(([key,label])=><label key={key}><input type="checkbox" checked={m.notificationCenter?.triggers?.[key] === true} onChange={e=>mini('notificationCenter',{...(m.notificationCenter||{}),triggers:{...(m.notificationCenter?.triggers||{}),[key]:e.target.checked}})}/> {label}</label>)}
              </div>
            </section>
            <section className="mini-section">
              <h3>会员通知记录</h3>
              <p className="muted">记录保留最近200条。当前阶段只建立记录存储与后台查看，微信发送执行会在第二期后续触发接入中写入 sent / failed / skipped 状态。</p>
              <div className="admin-table-wrap"><table className="admin-table compact-table"><thead><tr><th>时间</th><th>类型</th><th>触发</th><th>对象</th><th>状态</th><th>说明</th></tr></thead><tbody>{notificationRecords.length?notificationRecords.map((row:any)=><tr key={row.id}><td>{row.createdAt}</td><td>{row.type}</td><td>{row.trigger || '—'}</td><td>{row.target || '—'}</td><td>{row.status}</td><td>{row.message || '—'}</td></tr>):<tr><td colSpan={6}>暂无通知记录。</td></tr>}</tbody></table></div>
            </section>
          </>
        ) : tab === 'release' ? (
          <>
            <div className="heading-row"><div><h2>小程序版本发布</h2><p className="muted">后台内容、首页装修、底部导航和微页面发布后，小程序可直接读取；只有代码包变化才需要上传体验版并提交微信审核。</p></div><button className="btn" onClick={() => loadReleaseState().catch((e) => setMessage(e.message))}>刷新状态</button></div>
            <section className="mini-section mini-release-workflow">
              <div className="mini-release-step"><span>1</span><div><h3>发布准备</h3><p>在这里配置微信应用并上传代码密钥；小程序代码包由部署自动生成。</p></div></div>
              <div className="mini-release-status-list">
                <div className={releaseState?.appidMasked && releaseState?.appidMatchesProject ? 'ok' : 'warn'}><b>AppID</b><strong>{releaseState?.appidMasked || '未配置'}</strong><p>{releaseState?.appidMatchesProject === false ? '后台 AppID 与代码包不一致，请核对。' : '可在下方微信应用配置中修改。'}</p></div>
                <div className={releaseState?.projectExists ? 'ok' : 'warn'}><b>小程序代码包</b><strong>{releaseState?.projectExists ? '已准备' : '未随版本部署'}</strong><p>{releaseState?.projectExists ? '部署时自动构建，无需手工上传。' : '当前镜像缺少代码包，需要部署包含小程序的新镜像。'}</p></div>
                <div className={releaseState?.privateKeyExists ? 'ok' : 'warn'}><b>代码上传密钥</b><strong>{releaseState?.privateKeyExists ? '已保存' : '待上传'}</strong><p>只在服务器私有目录保存，后台不显示内容。</p></div>
                <div className={releaseState?.tokenConfigured ? 'ok' : 'warn'}><b>审核调用凭证</b><strong>{releaseState?.tokenConfigured ? '已配置 AppSecret' : '待配置 AppSecret'}</strong><p>提交审核时由服务端向微信获取临时令牌，无需手工填写。</p></div>
              </div>
              {!releaseState?.configured && <p className="notice">当前还不能上传体验版。请完成下方配置；如果代码包缺失，应先部署包含小程序构建产物的新镜像。后台内容发布后仍由小程序直接读取。</p>}
              <MiniLoginSettings onSaved={() => loadReleaseState().catch((error) => setMessage(error.message))}/>
              <div className="mini-release-key-upload">
                <div><b>代码上传密钥</b><p className="muted">从微信公众平台下载 .key 文件后在这里上传。只有站点所有者可以更换；文件内容不会在后台回显。</p></div>
                <div className="flex-actions"><input type="file" accept=".key,text/plain" aria-label="选择代码上传密钥文件" disabled={!releaseState?.canManageKey || Boolean(releaseBusy)} onChange={(event) => setReleaseKeyFile(event.target.files?.[0] || null)}/><button className="btn primary" disabled={!releaseState?.canManageKey || !releaseKeyFile || Boolean(releaseBusy)} aria-busy={releaseBusy === 'key'} onClick={uploadReleaseKey}>上传密钥</button></div>
              </div>
              {!releaseState?.canManageKey && <p className="muted">更换上传密钥需要站点所有者权限。</p>}
              <p className="muted">微信公众平台的“代码上传 IP 白名单”仍需管理员在微信侧设置；这是微信平台的安全规则。</p>
            </section>
            <section className="mini-section mini-release-workflow">
              <div className="mini-release-step"><span>2</span><div><h3>体验版</h3><p>生成预览码给手机确认；确认无误后上传体验版。机器人通道当前为 robot {releaseState?.robot || 1}。</p></div></div>
              <div className="field-grid">
                <Field label="版本号" value={releaseForm.version} onChange={(v: string)=>setReleaseForm({...releaseForm,version:v})}/>
                <Field label="版本说明" value={releaseForm.desc} onChange={(v: string)=>setReleaseForm({...releaseForm,desc:v})}/>
              </div>
              <div className="mini-section-actions"><span>这一步只影响微信体验版代码包，不会改变后台已发布内容。</span><div className="flex-actions"><button aria-busy={releaseBusy === 'preview'} className="btn" disabled={Boolean(releaseBusy) || !releaseState?.configured} onClick={()=>runRelease('preview')}>生成预览码</button><button aria-busy={releaseBusy === 'upload'} className="btn primary" disabled={Boolean(releaseBusy) || !releaseState?.configured} onClick={()=>runRelease('upload')}>上传体验版</button></div></div>
              {releaseQr && <div className="mini-release-qr"><img src={releaseQr} alt="小程序预览码"/><p className="muted">请使用微信扫码预览体验版。</p></div>}
            </section>
            <section className="mini-section mini-release-workflow">
              <div className="mini-release-step"><span>3</span><div><h3>提交微信审核</h3><p>提交审核前需先上传体验版，并填写微信公众平台当前要求的审核页面、标签和类目。</p></div></div>
              <div className="field-grid mini-audit-grid">
                <Field label="审核页面路径" value={auditForm.address} onChange={(v: string)=>setAuditForm({...auditForm,address:v})}/>
                <Field label="页面标题" value={auditForm.title} onChange={(v: string)=>setAuditForm({...auditForm,title:v})}/>
                <Field label="标签" value={auditForm.tag} onChange={(v: string)=>setAuditForm({...auditForm,tag:v})}/>
                <Field label="一级类目名称" value={auditForm.first_class} onChange={(v: string)=>setAuditForm({...auditForm,first_class:v})}/>
                <Field label="一级类目ID" value={auditForm.first_id} onChange={(v: string)=>setAuditForm({...auditForm,first_id:v})}/>
                <Field label="二级类目名称" value={auditForm.second_class} onChange={(v: string)=>setAuditForm({...auditForm,second_class:v})}/>
                <Field label="二级类目ID" value={auditForm.second_id} onChange={(v: string)=>setAuditForm({...auditForm,second_id:v})}/>
                <Field label="三级类目名称（选填）" value={auditForm.third_class} onChange={(v: string)=>setAuditForm({...auditForm,third_class:v})}/>
                <Field label="三级类目ID（选填）" value={auditForm.third_id} onChange={(v: string)=>setAuditForm({...auditForm,third_id:v})}/>
              </div>
              <div className="mini-release-disabled"><button aria-busy={releaseBusy === 'submitAudit'} className="btn primary" disabled={Boolean(releaseBusy) || !releaseState?.actions?.submitAudit} onClick={()=>runRelease('submitAudit')}>提交微信审核</button><button className="btn" disabled>发布上线</button><span className="muted">发布上线仍保留为下一步，审核通过后再接入状态查询、发布和回滚记录。</span></div>
            </section>
            <section className="mini-section">
              <h3>最近发布记录</h3>
              <div className="admin-table-wrap"><table className="admin-table compact-table"><thead><tr><th>时间</th><th>动作</th><th>版本</th><th>状态</th><th>说明</th></tr></thead><tbody>{releaseState?.records?.length ? releaseState.records.map((row:any)=><tr key={row.id}><td>{row.finishedAt || row.createdAt}</td><td>{row.action === 'preview' ? '预览码' : row.action === 'submitAudit' ? '提交审核' : '体验版'}</td><td>{row.version}</td><td>{row.status}</td><td>{row.message || row.desc}</td></tr>) : <tr><td colSpan={5}>暂无发布记录。</td></tr>}</tbody></table></div>
            </section>
          </>
        ) : tab === 'nav' ? (
          <>
            <h2>底部导航</h2>
            <label>
              <input
                type="checkbox"
                checked={n.enabled}
                onChange={(e) =>
                  mini('navigation', { ...n, enabled: e.target.checked })
                }
              />{' '}
              启用底部导航（2—5项）
            </label>
            {n.items.map((item: any, i: number) => (
              <div className="footer-config-card mini-nav-row" key={i}>
                {controls(
                  n.items,
                  (v) => mini('navigation', { ...n, items: v }),
                  i,
                )}
                <div className="field-grid">
                  <Field
                    label="名称"
                    value={item.label}
                    onChange={(v: string) => navUpdate(i, 'label', v)}
                  />
                  <Choice
                    label="页面"
                    value={item.target}
                    items={miniTargets.filter(([key])=>miniReadyTargets.includes(key))}
                    onChange={(v: string) => mini('navigation',{...n,items:n.items.map((row:any,j:number)=>i===j?{...row,target:v,contentId:''}:row)})}
                  />
                  {item.target === 'microPage' && <Choice label="微页面" value={item.contentId || ''} items={(m.microPages || []).filter((p:any)=>p.status==='published').map((p:any)=>[p.id,p.title])} onChange={(v:string)=>navUpdate(i,'contentId',v)}/>}
                  {image(
                    item.iconId,
                    (v) => navUpdate(i, 'iconId', v),
                    '默认图标',
                  )}
                  {image(
                    item.selectedIconId,
                    (v) => navUpdate(i, 'selectedIconId', v),
                    '选中图标',
                  )}
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => navUpdate(i, 'enabled', e.target.checked)}
                  />
                  显示
                </label>
              </div>
            ))}
            <button
              className="btn"
              disabled={n.items.length >= 5 || n.items.length >= miniReadyTargets.length}
              onClick={() => {
                if (n.items.length >= 5) return;
                const t = miniTargets.filter(([key])=>miniReadyTargets.includes(key)).find(
                  ([k]) => !n.items.some((r: any) => r.target === k),
                );
                if (t)
                  mini('navigation', {
                    ...n,
                    items: [
                      ...n.items,
                      {
                        target: t[0],
                        label: t[1],
                        enabled: true,
                        iconId: '',
                        selectedIconId: '',
                      },
                    ],
                  });
              }}
            >
              添加导航
            </button>
            <div role="status"
              className="notice"
              style={{ display: 'flex', gap: 24, marginTop: 20 }}
              aria-label="导航预览"
            >
              {n.enabled
                ? n.items
                    .filter((x: any) => x.enabled)
                    .map((x: any) => (
                      <span key={x.target+':' +(x.contentId||'')}>
                        {x.iconId && (
                          <img
                            alt=""
                            src={'/api/media/' + x.iconId}
                            width={24}
                            height={24}
                          />
                        )}{' '}
                        {x.label}
                      </span>
                    ))
                : '底部导航已关闭'}
            </div>
          </>
        ) : (
          <>
            <h2>发布与检查</h2>
            <div className="mini-check-grid">
              <div><span>配置版本</span><strong>{state.publishedAt ? '已发布' : '尚未发布'}</strong><p>{state.publishedAt || '保存草稿后可发布配置'}</p></div>
              <div><span>应用连接</span><strong>{m.appId && m.apiOrigin ? '已填写' : '待完善'}</strong><p>AppID {m.appId ? '已填写' : '未填写'} · 接口域名 {m.apiOrigin ? '已填写' : '未填写'}</p></div>
              <div><span>设备验收</span><strong>待验收</strong><p>微信开发者工具 / iPhone / Android</p></div>
            </div>
            <p className="muted">发布配置会更新首页和导航；新增程序功能仍需提交微信版本审核。</p>
            <button aria-busy={Boolean(busy)}
              className="btn"
              disabled={busy || !state.previous}
              onClick={() => save('rollback')}
            >
              恢复上一发布版本
            </button>
          </>
        )}
      </div>
      <div className="mini-save-bar"><span role="status">{message || (dirty ? '有未保存修改' : '草稿已同步')}</span><div className="flex-actions"><button aria-busy={Boolean(busy)} className="btn" disabled={busy} onClick={()=>save('save')}>保存草稿</button><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy} onClick={()=>save('publish')}>发布配置</button></div></div>
      {picker && (
        <AssetPicker
          accept="image"
          data={data}
          multiple={false}
          onClose={() => setPicker(null)}
          onSelect={(a: any) => {
            picker.apply(a.id);
            setPicker(null);
          }}
        />
      )}
    </section>
  );
}
