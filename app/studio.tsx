'use client';
import SiteLink from '../components/site-link';
import { SOFTWARE_VERSION_DETAIL, SOFTWARE_VERSION_LABEL } from '@/lib/app-version';

import { useRouter } from 'next/navigation';
import StatisticsDashboard from './manage/dashboard';
import { useEffect, useState, useCallback } from 'react';
import { ContentManager, AssetManager } from './manage/content';
import {
  SettingsManager,
  ThemeManager,
  UsersManager,
  GeoManager,
} from './manage/configuration';
import WorkspaceNav, { groups } from './manage/workspace-nav';
import ChannelSettings from './manage/channel-settings';
import Orders from './manage/orders';
import AdminPointsMall from './manage/points-mall';
import PointsManager from './manage/points';
import AccountAccess from './manage/account-access';
import FormWorkspaceTabs from './manage/form-workspace-tabs';
import Marketing from './manage/marketing';
import VideoSeries from './manage/video-series';
import { VideoSourceLibrary } from './manage/video-source-picker';
import Records from './manage/records';
import Collections from './manage/collections';
import PolicyManager from './manage/policies';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowUpRight,
  Plus,
  LayoutDashboard,
  FileText,
  Package,
  ClipboardList,
  Images,
  Users,
  Palette,
  Settings,
  Sparkles,
  CircleHelp,
  CheckCircle2,
  ScanSearch,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import './admin-compact.css';
import { AdminTrail } from './manage/admin-navigation';
const menus = [
  ['overview', '总览', LayoutDashboard],
  ['marketing', '营销中心', Sparkles],
  ['orders', '订单', Package],
  ['articles', '文章管理', FileText],
  ['articleCategories', '文章分类', FileText],
  ['products', '商品管理', Package],
  ['productCategories', '商品分类', Package],
  ['navigation', '导航管理', ArrowRight],
  ['forms', '表单管理', ClipboardList],
  ['submissions', '表单列表', ClipboardList],
  ['logs', '操作日志', FileText],
  ['assets', '素材中心', Images],

  ['admins', '管理员', Users],
  ['users', '会员管理', Users],
  ['policies', '协议与政策', FileText],
  ['geo', 'GEO 洞察', ScanSearch],
  ['themes', '主题模板', Palette],
  ['settings', '网站设置', Settings],
] as const;
export default function Dashboard({ view = 'overview' }: { view?: string }) {
  const router=useRouter();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    const r = await fetch('/api/admin');
    const d: any = await r.json();
    if (!r.ok) throw new Error(d.error);
    setData(d);
    setError('');
  }, []);
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'navigate_content_workspace',
            title: '打开内容工作区',
            description:
              'Navigate to an existing CMS section; does not create or publish content.',
            inputSchema: {
              type: 'object',
              properties: {
                section: {
                  type: 'string',
                  enum: groups.flatMap((g) => g.items).map((m) => m[0]),
                },
              },
              required: ['section'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input: any) {
              if (
                !input ||
                !groups
                  .flatMap((g) => g.items)
                  .some((m) => m[0] === input.section)
              )
                throw new Error('Invalid section');
              router.push('/admin?view=' + input.section);
              return { navigationStarted: true, section: input.section };
            },
          },
          { signal: controller.signal },
        ),
      ).catch((e) => console.warn('Optional agent tools unavailable', e));
    } catch (e) {
      console.warn('Optional agent tools unavailable', e);
    }
    return () => controller.abort();
  }, [router]);
  return (
    <SidebarProvider className="admin-workspace" open={true}
      style={{ '--sidebar-width': '216px' } as React.CSSProperties}
    >
      <Sidebar>
        <SidebarHeader className="px-6 py-6">
          <SiteLink href="/admin" className="brand">
            <span className="brand-icon">
              <Sparkles size={21} />
            </span>
            <span>
              爱神 AiTion<small>CONTENT & COMMERCE</small>
            </span>
          </SiteLink>
        </SidebarHeader>
        <SidebarContent className="px-4">
          <WorkspaceNav view={view} data={data} />
        </SidebarContent>
        <SidebarFooter className="px-5 py-5">
          <SiteLink className="nav-item account-summary" href="/admin/profile" aria-label="打开个人设置">
            <span
              className="brand-icon"
              style={{ width: 30, height: 30, fontSize: 13 }}
            >
              G
            </span>
            <span>
              {data?.user.role === 'editor' ? '内容编辑员' : '站点管理员'}
              <br />
              <small className="muted" style={{ fontSize: 12 }}>
                账户与个人设置
              </small>
            </span>
          </SiteLink>
          <SiteLink
            className="nav-item"
            href="/admin/login"
            onClick={async (e) => {
              e.preventDefault();
              await fetch('/api/staff/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
              });
              location.href = '/admin/login';
            }}
            target="_top"
          >
            退出登录
          </SiteLink>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="admin-header">
          <div className="flex-actions">
            <SidebarTrigger className="md:hidden" />
            <span className="breadcrumb">
              工作空间{' '}
              <span style={{ margin: '0 14px', color: '#c9c8d2' }}>/</span>{' '}
              <b style={{ color: '#51515f', fontWeight: 500 }}>
                {!['mini','marketing'].includes(view) && <>{['videoSeries', 'forms', 'submissions', 'pointsMall'].includes(view)
                  ? '营销中心'
                  : groups.find((g) => g.items.some((i) => i[0] === view))
                      ?.label}{' '}
                /{' '}</>}
                {view === 'pointsMall' ? '积分商城' : view === 'forms'
                  ? '表单管理'
                  : view === 'submissions'
                    ? '提交记录'
                    : view === 'videoSeries'
                      ? '视频专栏'
                      : groups
                          .flatMap((g) => g.items)
                          .find((i) => i[0] === view)?.[1] || '数据概览'}
              </b>
              <AdminTrail view={view}/>
            </span>
          </div>
          <div className="flex-actions">
            <span className="pill green">● 工作空间</span>
            <span className="pill admin-version-pill" title={`当前软件版本 ${SOFTWARE_VERSION_DETAIL}`}>
              {SOFTWARE_VERSION_DETAIL}
            </span>
            <SiteLink className="btn" href="/zh">
              <ExternalLink />
              查看前台
            </SiteLink>
          </div>
        </header>
        <main className="workspace">
          {error ? (
            <div className="error" role="alert">
              {error}
              <button
                className="btn"
                onClick={() => reload().catch((e) => setError(e.message))}
              >
                重新加载
              </button>
            </div>
          ) : !data ? (
            <div className="panel loading-panel">
              <Skeleton className="h-12 w-full mb-5" />
              <Skeleton className="h-40 w-full" />
              <p className="muted">正在读取工作空间…</p>
            </div>
          ) : data.user.role !== 'owner' &&
            [
              'mini',
              'floating',
              'videoSeries',
              'navigation',
              'submissions',
              'logs',
              'admins',
              'accounts',
              'permissions',
              'users',
              'points',
              'pointsMall',
              'policies',
              'geo',
              'themes',
              'settings',
            ].includes(view) ? (
            <div role="status" className="notice">
              当前账号没有此模块的访问权限。
              <SiteLink href="/admin?view=articles">返回文章管理</SiteLink>
            </div>
          ) : view !== 'overview' ? (
            <>
              {['forms','submissions'].includes(view) && <FormWorkspaceTabs view={view} canViewSubmissions={data.user.role === 'owner'} />}
              {['mini','floating'].includes(view) ? <ChannelSettings key={view} data={data} floatingOnly={view==='floating'} /> : view === 'videos' && data.user.role === 'owner' ? (
                <section>
                  <h1>视频素材库</h1>
                  <VideoSourceLibrary data={data} />
                </section>
              ) : view === 'videoSeries' ? (
                <VideoSeries data={data} />
              ) : view === 'pointsMall' ? (
                <AdminPointsMall categories={data.categories} role={data.user.role} permissions={data.user.permissions} />
              ) : view === 'points' ? (
                <PointsManager />
              ) : ['accounts','admins','permissions','logs'].includes(view) ? (
                <AccountAccess key={view} initialTab={view==='permissions'?'groups':view==='logs'?'logs':'accounts'} />
              ) : ['orders', 'payments', 'aftersales', 'commerce'].includes(
                  view,
                ) ? (
                <Orders
                  role={data.user.role} permissions={data.user.permissions}
                  key={view}
                  initialTab={
                    (
                      {
                        payments: 'review',
                        aftersales: 'aftersale',
                        commerce: 'settings',
                      } as any
                    )[view] || 'list'
                  }
                />
              ) : view === 'marketing' ? (
                <Marketing data={data} />
              ) : ['articles', 'products', 'forms'].includes(view) ? (
                <ContentManager
                  key={view}
                  kind={view}
                  data={data}
                  reload={reload}
                />
              ) : [
                  'articleCategories',
                  'productCategories',
                  'folders',
                  'navigation',
                  'admins',
                ].includes(view) ? (
                <Collections
                  key={view}
                  view={view}
                  data={data}
                  reload={reload}
                />
              ) : view === 'policies' ? (
                <PolicyManager data={data} reload={reload} />
              ) : ['assets', 'videos'].includes(view) ? (
                <AssetManager
                  key={view}
                  accept={view === 'videos' ? 'video' : 'image'}
                  data={data}
                  reload={reload}
                />
              ) : view === 'geo' ? (
                <GeoManager data={data} reload={reload} />
              ) : view === 'themes' ? (
                <ThemeManager data={data} reload={reload} />
              ) : ['users', 'submissions', 'logs'].includes(view) ? (
                <Records key={view} kind={view} data={data} />
              ) : (
                <SettingsManager data={data} reload={reload} />
              )}
            </>
          ) : (
            <StatisticsDashboard />
          )}
          <footer className="admin-footer">
            <span>爱神 AiTion · 让内容连接更多可能</span>
            <span>中文管理后台 · 多语言内容工作空间 · {SOFTWARE_VERSION_DETAIL}</span>
          </footer>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
