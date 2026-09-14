import { redirect } from 'next/navigation';
import { workspaceView } from '@/lib/workspace-route.mjs';
import Dashboard from '../studio';
import LoginView from '../login/login-view';
import { admin } from '@/lib/server';
import { Sparkles } from 'lucide-react';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'GEO Studio · 中文管理后台',
  robots: { index: false, follow: false },
};
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const input = await searchParams;
  const view = workspaceView(input.view);
  try {
    await admin();
  } catch (e: any) {
    if (e.message === '请先修改初始密码') redirect('/admin/profile');
    redirect('/admin/login');
  }
  return <Dashboard view={view} />;
}
