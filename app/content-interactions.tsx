'use client';
import { behavior } from './behavior-client';
import { useEffect, useState } from 'react';
import { Heart, Bookmark, Share2 } from 'lucide-react';
export default function ContentInteractions({
  kind,
  id,
  en = false,
}: {
  kind: string;
  id: string;
  en?: boolean;
}) {
  const [actions, setActions] = useState<string[]>([]),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setActions([]);
    fetch(
      `/api/points/state?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`,
    )
      .then(async (r) => {
        const d: any = await r.json();
        if (r.ok && live) setActions(d.actions || []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [kind, id]);
  async function act(action: string) {
    setBusy(true);
    setMessage('');
    try {
      if (action === 'share') {
        const url = new URL(location.href);
        if (kind === 'video') url.searchParams.set('episode', id);
        await navigator.clipboard.writeText(url.href);
      }
      const active = action === 'share' || !actions.includes(action);
      const r = await fetch('/api/points/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, action, active }),
      });
      const d: any = await r.json();
      if (r.status === 401) {
        location.assign(
          `/${en ? 'en' : 'zh'}/account?` +
            new URLSearchParams({
              returnTo: location.pathname + location.search,
            }),
        );
        return;
      }
      if (!r.ok)
        throw new Error(
          d.error || (en ? 'Please try again' : '操作失败，请重试'),
        );
      if(action==='favorite'&&active)behavior('favorite',id);
      setActions((a) =>
        active ? [...new Set([...a, action])] : a.filter((x) => x !== action),
      );
      setMessage(
        d.earned
          ? `+${d.earned} ${en ? 'points' : '积分'}`
          : action === 'share'
            ? en
              ? 'Link copied'
              : '链接已复制'
            : en
              ? 'Saved'
              : '已更新',
      );
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="content-interactions interaction-bar">
      {(
        [
          ['like', Heart, en ? 'Like' : '点赞'],
          ['favorite', Bookmark, en ? 'Save' : '收藏'],
          ['share', Share2, en ? 'Share' : '分享'],
        ] as const
      ).map(([key, Icon, label]) => (
        <button aria-busy={Boolean(busy)}
          className="btn"
          type="button"
          key={key}
          disabled={busy}
          aria-pressed={key === 'share' ? undefined : actions.includes(key)}
          onClick={() => act(key)}
        >
          <Icon
            size={18}
            fill={
              key !== 'share' && actions.includes(key) ? 'currentColor' : 'none'
            }
          />
          {label}
        </button>
      ))}
      <span role="status">{message}</span>
    </div>
  );
}
