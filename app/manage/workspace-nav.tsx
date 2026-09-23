'use client';

import Link from '../../components/site-link';

import {
  LayoutDashboard,
  Package,
  FileText,
  Sparkles,
  Images,
  Users,
  Settings,
  Smartphone,
  Globe2,
  ChevronDown,
} from 'lucide-react';
export const groups = [
  { label: '工作台', icon: LayoutDashboard, items: [['overview', '数据概览']] },
  {
    label: '商品与订单',
    icon: Package,
    items: [
      ['products', '商品管理'],
      ['productCategories', '商品分类'],
      ['orders', '订单管理'],
    ],
  },
  {
    label: '内容管理',
    icon: FileText,
    items: [
      ['articles', '文章管理'],
      ['articleCategories', '文章分类'],
    ],
  },
  {
    label: '营销中心',
    icon: Sparkles,
    items: [['marketing', '营销中心']],
  },
  {label: '小程序',icon: Smartphone,items: [['mini','小程序']]},
  {
    label: '素材中心',
    icon: Images,
    items: [
      ['assets', '图片库'],
      ['videos', '视频库'],
    ],
  },
  {
    label: '会员与洞察',
    icon: Users,
    items: [
      ['users', '会员管理'],
      ['points', '积分管理'],
      ['geo', 'GEO 洞察'],
    ],
  },
  {
    label: '网站管理',
    icon: Globe2,
    items: [
      ['settings', '网站设置'],
      ['floating', '悬浮入口'],
      ['navigation', '导航管理'],
      ['themes', '主题模板'],
      ['policies', '协议与政策'],
    ],
  },
  {
    label: '系统设置',
    icon: Settings,
    items: [
      ['commerce', '交易设置'],
      ['accounts', '账号与权限'],
    ],
  },
];
export default function WorkspaceNav({ view, data }: any) {
  const badge = (key: string) => {
    if (key === 'submissions')
      return data?.pendingCounts?.submissions
        ? `待处理 ${data.pendingCounts.submissions}`
        : '';
    const status =
      key === 'payments'
        ? 'pending_review'
        : key === 'aftersales'
          ? 'aftersale'
          : '';
    if (!status) return '';
    const rows = (data?.pendingCounts?.orders || []).filter(
      (r: any) => r.status === status && !r.sandbox,
    );
    return rows
      .map((r: any) => String(r.count))
      .join(' / ');
  };
  const allowed = [
    'overview',
    'articles',
    'articleCategories',
    'products',
    'productCategories',
    'forms',
    'marketing',
    'assets',
    'videos',
  ];
  return (
    <nav className="workspace-menu" aria-label="后台导航">
      {groups.map((g) => {
        const items = g.items.filter(
          (i) => data?.user.role === 'owner' || allowed.includes(i[0]) ||
            (i[0] === 'orders' && data?.user.permissions?.includes('orders.view')) ||
            (i[0] === 'commerce' && data?.user.permissions?.includes('orders.settings')),
        );
        if (!items.length) return null;
        const Icon = g.icon;
        if (g.label === '小程序') return <Link prefetch={false} key={g.label} className={'menu-group nav-item '+(view==='mini'?'active':'')} href='/admin?view=mini'><Icon size={18}/><span>小程序</span></Link>;
        if (g.label === '营销中心')
          return (
            <Link prefetch={false}
              key={g.label}
              className={
                'menu-group nav-item ' +
                (['marketing', 'forms', 'submissions', 'videoSeries', 'pointsMall'].includes(
                  view,
                )
                  ? 'active'
                  : '')
              }
              href="/admin?view=marketing"
            >
              <Icon size={18} />
              <span>营销中心</span>
            </Link>
          );
        return (
          <div key={g.label}>
            <div className="menu-group expanded">
              <Icon size={18} />
              <span>{g.label}</span>
            </div>
            <div className="menu-children">
              {items.map(([key, label]) => (
                <Link prefetch={false}
                  key={key}
                  aria-current={view === key || (key==='accounts'&&['admins','permissions','logs'].includes(view)) ? 'page' : undefined}
                  className={'nav-item ' + (key === view || (key==='accounts'&&['admins','permissions','logs'].includes(view)) ? 'active' : '')}
                  href={'/admin?view=' + key}
                >
                  {label}
                  {badge(key) && (
                    <small className="menu-count">{badge(key)}</small>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
