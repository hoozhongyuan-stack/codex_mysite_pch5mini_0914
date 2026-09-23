/** UI-only query changes preserve the surrounding list context. */
export function patchAdminQuery(search, values) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value === null || value === undefined) params.delete(key);
    else params.set(key, String(value));
  }
  return '?' + params.toString();
}
export function adminTrail(view, search) {
  const p = new URLSearchParams(search);
  const trail = [];
  const add = (label, reset) => trail.push({ label, reset });
  if (view === 'marketing' && (p.get('salons') || p.get('salon'))) {
    add('沙龙会', { salon: '', salonTab: '', salons: '1' });
    if (p.get('salon')) {
      add('活动详情', { salonTab: 'info' });
      const tab = p.get('salonTab') || 'registrations';
      if (tab !== 'info') add(tab === 'stats' ? '统计与签到' : '报名记录', {});
    }
  }
  if (view === 'videoSeries' && p.get('series')) add('系列详情', {});
  if (['orders','payments','aftersales','pointsMall'].includes(view) && p.get('order')) add('订单详情', {});
  const tabs = {
    settings: ['settingsTab', { base: '基础信息', brand: '品牌与图标', footer: '页脚设置', smtp: '邮件服务', social: '社交登录' }],
    commerce: ['orderTab', { settings: '交易设置' }],
    pointsMall: ['mallTab', { products: '兑换商品', orders: '兑换订单' }],
    accounts: ['accessTab', { accounts: '子账号', groups: '权限组', logs: '操作日志' }],
    points: ['pointsTab', { accounts: '积分账户', ledger: '积分明细', rules: '奖励规则' }],
    mini: ['miniTab', { base: '基础配置', home: '首页装修', micros: '微页面管理', nav: '底部导航', notify: '通知中心', release: '版本发布', checks: '版本与检查' }],
  };
  const config = tabs[['admins','permissions','logs'].includes(view) ? 'accounts' : view];
  if (config && p.get(config[0]) && config[1][p.get(config[0])]) {
    trail.unshift({label: config[1][p.get(config[0])], reset: {}});
  }
  return trail;
}
