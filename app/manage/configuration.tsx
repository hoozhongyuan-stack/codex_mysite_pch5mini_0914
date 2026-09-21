'use client';
import { AdminTabs } from './admin-ui';
import { useAdminTab, useAdminUnsavedChanges } from './admin-navigation';
import SiteLink from '../../components/site-link';

import { useState, useEffect } from 'react';
import GeoHealthPanel from './geo-health-panel';
import SocialSettings from './social-settings';
import SmtpSettings from './smtp';
import FooterSettings from './footer';
import BrandSettings from './brand';
import {
  Check,
  ExternalLink,
  Plus,
  ScanSearch,
  ShieldCheck,
  Mail,
} from 'lucide-react';
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './admin-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, mutate } from './shared';
export function SettingsManager({ data, reload }: any) {
  const [tab, setTab] = useAdminTab('settingsTab', 'base', ['base','brand','footer','smtp','social']);
  const [dirty, setDirty] = useState(false);
  useAdminUnsavedChanges(dirty);
  const [settings, setSettings] = useState(data.settings);
  useEffect(() => { setDirty(false); setSettings(data.settings); }, [tab, data.settings]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) =>
    setSettings((s: any) => ({ ...s, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('saveSettings', { data: settings });
      await reload();
      setMessage('网站设置已保存');
      setDirty(false);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="heading-row">
        <div>
          <h1>网站设置</h1>
          <p className="muted">品牌信息会同步到前台与搜索元数据。</p>
        </div>
      </div>
      <AdminTabs label="网站设置栏目" value={tab} items={[
        ['base','基础信息'],['brand','品牌与图标'],['footer','页脚设置'],['smtp','邮件服务'],['social','社交登录']
      ]} onChange={key=>{if(key===tab)return; setTab(key);}}/>
      <div className="settings-content" onChangeCapture={() => setDirty(true)}>
        {tab === 'base' && (
          <form className="panel settings-panel" onSubmit={save}>
            <h2>品牌与内容</h2>
            <div className="field-grid">
              <Field
                label="网站名称 · 中文"
                value={settings.nameZh}
                onChange={(v: string) => set('nameZh', v)}
                required
              />
              <Field
                label="网站名称 · English"
                value={settings.nameEn}
                onChange={(v: string) => set('nameEn', v)}
                required
              />
            </div>
            <div className="field-grid">
              <Field
                label="首页标题 · 中文"
                value={settings.heroZh}
                onChange={(v: string) => set('heroZh', v)}
                multiline
              />
              <Field
                label="首页标题 · English"
                value={settings.heroEn}
                onChange={(v: string) => set('heroEn', v)}
                multiline
              />
            </div>
            <div className="field-grid">
              <Field
                label="品牌介绍 · 中文"
                value={settings.descriptionZh}
                onChange={(v: string) => set('descriptionZh', v)}
                multiline
                maxLength={800}
              />
              <Field
                label="品牌介绍 · English"
                value={settings.descriptionEn}
                onChange={(v: string) => set('descriptionEn', v)}
                multiline
                maxLength={800}
              />
            </div>
            <Field
              label="公开联系邮箱（可选）"
              value={settings.contactEmail}
              type="email"
              onChange={(v: string) => set('contactEmail', v)}
            />
            <div role="status" className="notice">
              前台语言：简体中文 /
              English。后台语言：简体中文。管理员邮箱：leohoo@petalmail.com,
              hopezhongyuan@gmail.com。
            </div>
            <button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
              {busy ? '保存中…' : '保存设置'}
            </button>
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
          </form>
        )}
        {tab === 'brand' && (
          <BrandSettings
            onDirty={() => setDirty(true)}
            data={data}
            reload={async () => {
              await reload();
              setDirty(false);
            }}
          />
        )}
        {tab === 'footer' && (
          <FooterSettings
            onDirty={() => setDirty(true)}
            data={data}
            reload={async () => {
              await reload();
              setDirty(false);
            }}
          />
        )}
        {tab === 'social' && <SocialSettings onSaved={() => setDirty(false)} />}
        {tab === 'smtp' && <SmtpSettings onSaved={() => setDirty(false)} />}
      </div>
    </>
  );
}
const themes = [
  {
    id: 'tech',
    name: '科技商务',
    tag: '清晰 · 专业 · 有力量',
    headline: 'Ideas that\nmove us forward.',
    description: '深色主视觉与鲜明对比，适合科技与专业服务品牌。',
  },
  {
    id: 'minimal',
    name: '极简品牌',
    tag: '留白 · 克制 · 专注',
    headline: 'Less, but\nmeaningful.',
    description: '宽松留白与大字号，让产品和品牌观点成为主角。',
  },
  {
    id: 'editorial',
    name: '内容杂志',
    tag: '阅读 · 观点 · 深度',
    headline: 'A new\nperspective.',
    description: '衬线标题与分栏阅读，适合知识型品牌与内容出版。',
  },
];
export function ThemeManager({ data, reload }: any) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  async function apply(id: string) {
    setBusy(id);
    try {
      await mutate('saveSettings', { data: { ...data.settings, theme: id } });
      await reload();
      setMessage('前台主题已切换，文章和商品内容保持同步。');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="heading-row">
        <div>
          <h1>主题模板</h1>
          <p className="muted">
            同一份内容，三种品牌表达。每套主题都适配 PC 与手机。
          </p>
        </div>
        <span className="pill">3 套可用主题</span>
      </div>
      <div className="theme-grid">
        {themes.map((t) => (
          <article className="panel" key={t.id}>
            <div className={`theme-preview preview-${t.id}`}>
              <div className="mini-nav">
                <b>YOUR BRAND</b>
                <span>Stories　Products　EN</span>
              </div>
              <p>{t.tag}</p>
              <h2>{t.headline}</h2>
              <span className="mini-link">Discover more ↗</span>
            </div>
            <div className="theme-details">
              <div className="heading-row">
                <h2>{t.name}</h2>
                {data.settings.theme === t.id && (
                  <span className="pill green">
                    <Check size={12} />
                    使用中
                  </span>
                )}
              </div>
              <p className="muted">{t.description}</p>
              <div className="flex-actions" style={{ marginTop: 18 }}>
                <SiteLink
                  className="btn"
                  href={`/zh?theme=${t.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink />
                  预览
                </SiteLink>
                <button aria-busy={Boolean(busy)}
                  className="btn primary"
                  disabled={!!busy || data.settings.theme === t.id}
                  onClick={() => apply(t.id)}
                >
                  {busy === t.id
                    ? '应用中…'
                    : data.settings.theme === t.id
                      ? '当前主题'
                      : '应用主题'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
export function UsersManager() {
  const [users, setUsers] = useState<any[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/identity-admin/users')
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        setUsers(d.users);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <div className="heading-row">
        <div>
          <h1>访客用户</h1>
          <p className="muted">独立邮箱账号，与后台管理员权限分离。</p>
        </div>
        <SiteLink className="btn" href="/zh/account">
          前台注册 / 登录 ↗
        </SiteLink>
      </div>
      <section className="panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓</TableHead>
              <TableHead>名</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.lastName}</TableCell>
                <TableCell>{u.firstName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <span className="pill">
                    {u.verified ? '邮箱已验证' : '待验证'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!users.length && (
          <div className="empty-state">
            {loading ? '正在读取…' : error || '暂无注册访客'}
          </div>
        )}
      </section>
    </>
  );
}
export function GeoManager({ data, reload }: any) {
  const [tab, setTab] = useAdminTab('geoTab','visits',['visits','evidence']);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    engine: '',
    query: '',
    url: '',
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate('addEvidence', { data: form });
      await reload();
      setOpen(false);
      setForm({ engine: '', query: '', url: '', note: '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const published = data.contents.filter((r: any) => r.status === 'published');
  return (
    <>
      <div className="heading-row">
        <div>
          <h1>GEO 洞察</h1>
          <p className="muted">看见访问，记录引用，用可复核的证据判断效果。</p>
        </div>
        <button className="btn primary" onClick={() => setOpen(true)}>
          <Plus />
          记录引用证据
        </button>
      </div>
      <div className="callout">
        <div>
          <h2>访问是线索，引用才需要证据。</h2>
          <p className="muted">
            爬虫依据请求标识识别，可能被伪造；来源访问也不等同引用。记录真实查询和结果链接，便于复核。
          </p>
        </div>
        <ScanSearch color="#8063dc" size={32} />
      </div>
      <div className="stats">
        {[
          ['已发布内容', published.length],
          [
            '声明为 AI 的爬虫',
            data.visits.filter((r: any) => r.kind === 'claimed_bot').length,
          ],
          [
            'AI 来源访问',
            data.visits.filter((r: any) => r.kind === 'ai_referral').length,
          ],
          ['人工引用记录', data.evidence.length],
        ].map(([label, n]) => (
          <div className="panel stat" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{n}</div>
            <p className="stat-note">
              {String(label).includes('访问') || String(label).includes('爬虫')
                ? '最近 1,000 条访问记录内'
                : '当前实际记录'}
            </p>
          </div>
        ))}
      </div>
      <GeoHealthPanel />
      <section className="panel" style={{padding:20,marginBottom:20}}>
        <h2>收录与引用验证</h2>
        <p>先检查公开访问，再到搜索引擎站长平台核验索引。未连接站长平台时，收录状态为“未核验”，不能从爬虫请求数推断。</p>
        <p>建议固定查询：品牌提供哪些产品？产品适合哪些使用场景？如何选择产品规格？在哪查看真实活动与视频？使用品牌全称替换泛称，并在同一平台定期复查。</p>
        <p>将平台、实际查询、引用网址与核验说明录入下方“引用证据”；无引用时如实记录查询结果，不填造引用链接。仅有页面访问不是引用证明。</p>
      </section>
      <section className="panel">
        <div className="section-head">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList>
              <TabsTrigger value="visits">访问记录</TabsTrigger>
              <TabsTrigger value="evidence">引用证据</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {tab === 'visits' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>来源</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>访问页面</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.visits.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.source}</TableCell>
                  <TableCell>
                    <span className="pill gray">
                      {r.kind === 'claimed_bot'
                        ? '请求自称爬虫'
                        : '客户端上报来源'}
                    </span>
                  </TableCell>
                  <TableCell>{r.path}</TableCell>
                  <TableCell>
                    {new Date(r.created_at).toLocaleString('zh-CN')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          data.evidence.map((r: any) => (
            <div className="submission" key={r.id}>
              <div className="flex-actions">
                <b>{r.engine}</b>
                <span className="pill gray">人工记录 · 待独立复核</span>
              </div>
              <h3 style={{ margin: '12px 0' }}>{r.query}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{r.note}</p>
              <SiteLink
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="title-link"
              >
                打开证据链接 ↗
              </SiteLink>
            </div>
          ))
        )}
        {!(tab === 'visits' ? data.visits : data.evidence).length && (
          <div className="empty-state">
            暂无{tab === 'visits' ? '访问记录' : '引用证据'}
            。这里仅展示实际记录。
          </div>
        )}
      </section>
      <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
        <DialogContent size="md" className="editor-dialog">
          <DialogHeader>
            <DialogTitle>记录引用证据</DialogTitle>
            <DialogDescription>
              保存可复查的信息；此记录不会被自动视为已验证引用。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save}>
            <Field
              label="AI 平台"
              value={form.engine}
              onChange={(v: string) => set('engine', v)}
              required
            />
            <Field
              label="实际查询问题"
              value={form.query}
              onChange={(v: string) => set('query', v)}
              required
            />
            <Field
              label="结果分享 / 证据链接（HTTPS）"
              value={form.url}
              onChange={(v: string) => set('url', v)}
              type="url"
              required
            />
            <Field
              label="引用摘录与核对说明"
              value={form.note}
              onChange={(v: string) => set('note', v)}
              multiline
              required
            />
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <AdminFormActions busy={busy}><button aria-busy={Boolean(busy)} className="btn primary" disabled={busy}>
              {busy ? '保存中…' : '保存证据'}
            </button></AdminFormActions>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
