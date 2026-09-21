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
export default function ChannelSettings({ data, floatingOnly = false }: any) {
  const [state, setState] = useState<any>(null),
    [form, setForm] = useState<any>(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [picker, setPicker] = useState<any>(null),
    [dirty, setDirty] = useState(false);
  const [tab, setTab] = useAdminTab('miniTab','base',['base','home','nav','checks']);
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
          ['base','基础配置'],['home','首页装修'],['nav','底部导航'],['checks','版本与检查']
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
          <>
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
                <MiniLinkPicker value={b} contents={data.contents} onChange={(next:any)=>mini('banners',m.banners.map((row:any,j:number)=>i===j?next:row))}/>
              </div>
            ))}
            {!m.banners.length && <p className="mini-empty">尚未添加轮播图。每张图可关联一个目标页面。</p>}</section></details>
            <details className="mini-module" open><summary>图片热区 · {(m.hotspotImages || []).length} 张</summary><MiniHotspots items={m.hotspotImages || []} onChange={(v:any)=>mini('hotspotImages',v)} selectImage={(apply:any)=>setPicker({apply})} contents={data.contents} onSave={()=>save('save')} busy={busy} message={message}/></details>
            <details className="mini-module" open><summary>商品楼层 · {m.productFloor?.enabled !== false ? '显示' : '隐藏'}</summary><section className="mini-section"><div className="field-grid"><label className="field"><span>展示设置</span><label><input type="checkbox" checked={m.productFloor?.enabled !== false} onChange={e=>mini('productFloor',{...(m.productFloor||{}),enabled:e.target.checked})}/> 在小程序首页展示商品楼层</label></label><Field label="楼层标题" value={m.productFloor?.title || '精选商品'} onChange={(v:string)=>mini('productFloor',{...(m.productFloor||{}),title:v})}/></div><p className="muted">关闭后不请求或展示首页推荐商品；已发布商品仍可从商城访问。</p></section></details>
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
                    onChange={(v: string) => navUpdate(i, 'target', v)}
                  />
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
                      <span key={x.target}>
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
