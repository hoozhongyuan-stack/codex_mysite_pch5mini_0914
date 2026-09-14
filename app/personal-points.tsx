'use client';
import SiteLink from '../components/site-link';

import { pointLabel } from '@/lib/point-labels';
import { useEffect, useState } from 'react';
export default function PersonalPoints({
  en,
  favorites = false,
}: {
  en: boolean;
  favorites?: boolean;
}) {
  const [section, setSection] = useState('ledger'),
    [page, setPage] = useState(1),
    [kind, setKind] = useState('');
  const [data, setData] = useState<any>({ rows: [] }),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const lang = en ? 'en' : 'zh',
    t = (zh: string, english: string) => (en ? english : zh);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    fetch(
      `/api/points/${favorites ? 'favorites' : 'summary'}?page=${page}&kind=${kind}`,
    )
      .then(async (r) => {
        const d: any = await r.json();
        if (!r.ok) throw Error(d.error);
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [favorites, page, kind]);
  const destinations: Record<string, string> = {
    article: 'articles',
    product: 'products',
    video: 'videos',
    salon: 'events',
    form: 'contact',
  };
  return (
    <section className="member-points">
      <div className="member-heading">
        <h2>
          {favorites
            ? t('我的收藏', 'Saved items')
            : t('我的积分', 'My points')}
        </h2>
        {!favorites && (
          <SiteLink className="btn primary" href={`/${lang}/points-shop`}>
            {t('去兑换', 'Redeem points')} ↗
          </SiteLink>
        )}
      </div>
      {!favorites && (
        <>
          <div className="member-stats">
            {[
              ['balance', '可用积分', 'Available'],
              ['earned', '累计获得', 'Earned'],
              ['spent', '累计支出 / 冲正', 'Used / reversed'],
            ].map(([key, zh, english]) => (
              <div key={key}>
                <span>{t(zh, english)}</span>
                <strong>{loading ? '—' : (data[key] ?? 0)}</strong>
              </div>
            ))}
          </div>
          <nav className="points-tabs">
            {[
              ['ledger', '收支明细', 'Transactions'],
              ['tasks', '积分任务', 'Points tasks'],
            ].map(([key, zh, english]) => (
              <button
                key={key}
                aria-pressed={section === key}
                onClick={() => setSection(key)}
              >
                {t(zh, english)}
              </button>
            ))}
          </nav>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {favorites && (
        <nav className="points-tabs favorite-tabs" aria-label={t('收藏类型','Content type')}>
          {[
            ['', '全部', 'All'], ['product','商品','Products'], ['article','文章','Articles'],
            ['salon','沙龙会','Events'], ['video','视频','Videos'],
          ].map(([key,zh,english])=><button key={key} aria-pressed={kind===key} onClick={()=>{setKind(key);setPage(1)}}>{t(zh,english)}</button>)}
        </nav>
      )}
      {!favorites && section === 'tasks' ? (
        <>
          <p className="muted">
            {t(
              '同类行为每天最多奖励一次，上海时区零点重置。',
              'Each action rewards once per content type per day, resetting at Shanghai midnight.',
            )}
          </p>
          {Object.entries(destinations).map(([key, path]) => {
            const tasks = (data.tasks || []).filter(
              (x: any) => x.key.split('.')[0] === key,
            );
            return (
              tasks.length > 0 && (
                <section className="member-task-group" key={key}>
                  <h3>
                    {t(
                      (
                        {
                          article: '文章',
                          product: '商品',
                          video: '视频',
                          salon: '活动',
                          form: '表单',
                        } as any
                      )[key],
                      key,
                    )}
                  </h3>
                  {tasks.map((task: any) => (
                    <div className="member-task" key={task.key}>
                      <span>{pointLabel(task.key, en)}</span>
                      <strong>+{task.amount}</strong>
                      {task.done ? (
                        <small>{t('今日已获奖', 'Completed today')}</small>
                      ) : (
                        <SiteLink href={`/${lang}/${path}`}>
                          {t('去完成', 'Explore')} ↗
                        </SiteLink>
                      )}
                    </div>
                  ))}
                </section>
              )
            );
          })}
          {(data.tasks || [])
            .filter((x: any) => x.key === 'login')
            .map((task: any) => (
              <p key={task.key}>
                {pointLabel(task.key, en)} · +{task.amount} ·{' '}
                {task.done
                  ? t('今日已获奖', 'Completed today')
                  : t('每日访问自动领取', 'Awarded on daily visit')}
              </p>
            ))}
        </>
      ) : (
        <>
          {loading ? (
            <p>{t('加载中…', 'Loading…')}</p>
          ) : (
            <div className="member-ledger">
              {data.rows.map((r: any, i: number) => (
                <div className="member-record" key={r.id || i}>
                  {favorites ? (
                    <SiteLink href={r.path?.replace(/^\/zh\//, `/${lang}/`) || '#'}>
                      {r.title || t('查看收藏', 'View saved item')} ↗
                    </SiteLink>
                  ) : (
                    <>
                      <div>
                        <b>{pointLabel(r.source, en)}</b>
                        <small>
                          {new Date(r.created).toLocaleString(
                            en ? 'en-US' : 'zh-CN',
                          )}
                        </small>
                      </div>
                      <strong className={r.amount > 0 ? 'earned' : ''}>
                        {r.amount > 0 ? '+' : ''}
                        {r.amount}
                      </strong>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {!loading && !data.rows.length && (
            <p className="member-empty">{t('暂无记录', 'No records yet')}</p>
          )}
          <div className="member-pager">
            <button aria-busy={Boolean(loading)}
              className="btn"
              disabled={loading || page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t('上一页', 'Previous')}
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil((data.total || 0) / 20))}
            </span>
            <button aria-busy={Boolean(loading)}
              className="btn"
              disabled={loading || page * 20 >= (data.total || 0)}
              onClick={() => setPage(page + 1)}
            >
              {t('下一页', 'Next')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
