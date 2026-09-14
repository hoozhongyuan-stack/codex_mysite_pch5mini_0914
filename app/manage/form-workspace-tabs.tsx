'use client';
import {useRouter} from 'next/navigation';
import './marketing-workspace.css';
export default function FormWorkspaceTabs({
  view,
  canViewSubmissions = false,
}: {
  view: string;
  canViewSubmissions?: boolean;
}) {
  const router=useRouter();
  const target = (view: string) => {
    const q = new URLSearchParams(window.location.search);
    const form = q.get('form');
    return (
      '/admin?view=' + view + (form ? '&form=' + encodeURIComponent(form) : '')
    );
  };
  const navigate = (
    event: React.MouseEvent<HTMLAnchorElement>,
    view: string,
  ) => {
    const href=target(view);
    event.currentTarget.href=href;
    if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){
      event.preventDefault();
      router.push(href);
    }
  };
  return (
    <nav className="form-workspace-tabs" aria-label="表单活动导航">
      <a
        href="/admin?view=forms"
        onClick={(e) => navigate(e, 'forms')}
        aria-current={view === 'forms' ? 'page' : undefined}
      >
        表单管理
      </a>
      {canViewSubmissions && (
        <a
          href="/admin?view=submissions"
          onClick={(e) => navigate(e, 'submissions')}
          aria-current={view === 'submissions' ? 'page' : undefined}
        >
          提交记录
        </a>
      )}
    </nav>
  );
}
