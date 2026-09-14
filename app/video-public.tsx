'use client';
import SiteLink from '../components/site-link';

import {observeVideo} from './behavior-client';
import {RichView} from '@/lib/rich-view';
import {displayVideoBody} from '@/lib/video-body.mjs';
import ContentInteractions from '@/app/content-interactions';
import { useEffect, useRef, useState } from 'react';
import { Play, Lock, Film, ArrowLeft, ArrowRight, Search } from 'lucide-react';
async function api(action: string, data: any = {}, post = false) {
  const r = await fetch(
    '/api/video/' + action + (post ? '' : '?' + new URLSearchParams(data)),
    post
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      : { cache: 'no-store' },
  );
  const d = (await r.json()) as any;
  if (!r.ok) throw Error(d.error);
  return d;
}
function Player({ episode, lang }: any) {
  const ref = useRef<HTMLVideoElement>(null),
    box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(''),
    [mark, setMark] = useState(''),
    [speed, setSpeed] = useState(1),
    [started, setStarted] = useState(false);
  const en = lang === 'en';
  useEffect(()=>{if(!started||!ref.current)return;return observeVideo(ref.current,episode.id);},[started,episode.id]);
  useEffect(() => {
    if (!started) return;
    let cancelled = false,
      hls: any,
      token = '',
      timer: any,
      renew: any;
    setError('');
    const start = async () => {
      const auth = await api('authorize', { id: episode.id }, true);
      token = auth.token;
      if (cancelled) {
        api('release', { token }, true).catch(() => {});
        return;
      }
      setMark(auth.watermark);
      const video = ref.current!;
      const src =
        '/api/video/stream?token=' +
        encodeURIComponent(token) +
        '&file=index.m3u8';
      const resume = () => {
        if (auth.position > 0 && auth.position < auth.duration - 1)
          video.currentTime = auth.position;
        video.play().catch(() => {});
      };
      video.addEventListener('loadedmetadata', resume, { once: true });
      const { default: Hls } = await import('hls.js');
      if (cancelled) return;
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_: any, d: any) => {
          if (d.fatal)
            setError(
              en ? 'Playback interrupted. Please retry.' : '播放中断，请重试。',
            );
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl'))
        video.src = src;
      else
        throw Error(
          en ? 'Browser not supported' : '当前浏览器不支持此视频格式',
        );
      video.onended = () => {
        api('progress', { token, position: video.currentTime }, true).catch(
          (e) => setError(e.message),
        );
      };
      timer = setInterval(() => {
        if (!video.paused && video.currentTime > 0)
          api('progress', { token, position: video.currentTime }, true).catch(
            (e) => setError(e.message),
          );
      }, 15000);
      renew = setInterval(
        () =>
          api('renew', { token }, true).catch((e) => {
            video.pause();
            setError(e.message);
          }),
        10 * 60 * 1000,
      );
    };
    start().catch((e) => setError(e.message));
    return () => {
      cancelled = true;
      clearInterval(timer);
      clearInterval(renew);
      if (ref.current) {
        ref.current.pause();
        ref.current.removeAttribute('src');
      }
      hls?.destroy();
      if (token) api('release', { token }, true).catch(() => {});
    };
  }, [episode.id, started]);
  return (
    <>
      <div
        className="protected-player"
        ref={box}
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={ref}
          poster={episode.imageId ? `/api/media/${episode.imageId}` : undefined}
          playsInline
          controls
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          preload="none"
          aria-label={episode[en ? 'titleEn' : 'titleZh']}
        />
        {mark && (
          <span className="video-watermark" aria-hidden="true">
            {mark}
          </span>
        )}
        {!started && (
          <button className="video-start" onClick={() => setStarted(true)}>
            <Play />
            {en ? 'Play episode' : '播放本集'}
          </button>
        )}
      </div>
      <div className="video-player-tools">
        <label>
          {en ? 'Speed' : '倍速'}{' '}
          <select
            aria-label={en ? 'Playback speed' : '播放速度'}
            value={speed}
            onChange={(e) => {
              setSpeed(Number(e.target.value));
              if (ref.current)
                ref.current.playbackRate = Number(e.target.value);
            }}
          >
            {[0.5, 1, 1.25, 1.5, 2].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          onClick={() =>
            box.current
              ?.requestFullscreen()
              .catch(() =>
                setError(en ? 'Fullscreen unavailable' : '当前设备不支持全屏'),
              )
          }
        >
          {en ? 'Fullscreen' : '全屏'}
        </button>
      </div>
      {error && (
        <div className="notice" role="alert">
          {error}{' '}
          <SiteLink href={'/' + lang + '/account'}>{en ? 'Sign in' : '登录账号'}</SiteLink>{' '}
          <button
            className="btn"
            onClick={() => {
              setStarted(false);
              setMark('');
              setError('');
            }}
          >
            {en ? 'Retry' : '重新播放'}
          </button>
        </div>
      )}
    </>
  );
}
export default function VideoPublic({ embedded=false, lang, id, initial }: any) {
  const en = lang === 'en',
    t = (o: any, k: string) => o?.[k + (en ? 'En' : 'Zh')] || '';
  const [result, setResult] = useState<any>(initial || { rows: [] }),
    [filters, setFilters] = useState({ q: '', type: '', page: 1 }),
    [error, setError] = useState(''),
    [selected, setSelected] = useState(initial?.episodes?.[0]?.id || '');
  useEffect(() => {
    if (!id || id === 'mine')
      api(id === 'mine' ? 'mine' : 'list', filters)
        .then(setResult)
        .catch((e) => setError(e.message));
  }, [id, filters]);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('episode');
    if (requested && result.episodes?.some((e: any) => e.id === requested)) setSelected(requested);
  }, [result.episodes]);
  const episode = result.episodes?.find((e: any) => e.id === selected);
  const index = result.episodes?.findIndex((e: any) => e.id === selected) || 0;
  return (
    <section className={embedded?"member-business video-page":"video-page"}>
      <div className="video-page-head">
        <p className="eyebrow">WATCH & DISCOVER</p>
        <h1>
          {id === 'mine'
            ? en
              ? 'Recently watched'
              : '最近观看'
            : id
              ? t(result.series, 'title')
              : en
                ? 'Stories worth watching'
                : '值得观看的每一集'}
        </h1>
        <p className="muted">
          {id && id !== 'mine'
            ? t(result.series, 'summary')
            : en
              ? 'Explore series, discover ideas, and keep learning.'
              : '探索短剧与课程，发现灵感，持续学习。'}
        </p>
        <div className="flex-actions">
          <SiteLink href={'/' + lang + '/videos'}>{en ? 'All series' : '全部系列'}</SiteLink>
          <SiteLink href={'/' + lang + '/videos/mine'}>
            {en ? 'Recently watched' : '最近观看'}
          </SiteLink>
        </div>
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}{' '}
          <SiteLink href={'/' + lang + '/account'}>{en ? 'Sign in' : '前往登录'}</SiteLink>
        </p>
      )}
      {!id || id === 'mine' ? (
        <>
          {!id && (
            <form
              className="video-filters"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setFilters({
                  ...filters,
                  q: String(f.get('q') || ''),
                  page: 1,
                });
              }}
            >
              <div className="category-tabs">
                {[
                  ['', en ? 'All' : '全部'],
                  ['drama', en ? 'Drama' : '短剧'],
                  ['course', en ? 'Courses' : '课程'],
                  ['other', en ? 'Other' : '其他'],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={filters.type === v ? 'active' : ''}
                    onClick={() => setFilters({ ...filters, type: v, page: 1 })}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="video-search">
                <Search size={18} />
                <input
                  name="q"
                  placeholder={en ? 'Search series' : '搜索系列名称'}
                />
                <button type="submit">{en ? 'Search' : '搜索'}</button>
              </label>
            </form>
          )}
          <div className="video-series-grid">
            {result.rows?.map((row: any) => {
              const s = row.episode || row;
              return (
                <SiteLink
                  className="video-series-card"
                  href={'/' + lang + '/videos/' + (s.seriesId || s.id)}
                  key={s.id}
                >
                  <div className="video-cover">
                    {s.imageId ? (
                      <img
                        src={'/api/media/' + s.imageId}
                        alt={t(s, 'title')}
                      />
                    ) : (
                      <Film size={48} />
                    )}
                    <span>
                      <Play size={18} />
                    </span>
                  </div>
                  <h2>{t(s, 'title')}</h2>
                  <p>{t(s, 'summary')}</p>
                  <small>
                    {id === 'mine'
                      ? `${Math.round(row.position)}s · ${row.completed ? (en ? 'Completed' : '已完成') : en ? 'In progress' : '观看中'}`
                      : `${s.episodes} ${en ? 'episodes' : '集'} · ${s.finished ? (en ? 'Complete' : '已完结') : en ? 'Updating' : '更新中'}`}
                  </small>
                </SiteLink>
              );
            })}
          </div>
          {!result.rows?.length && !error && (
            <p role="status" className="notice">{en ? 'No videos yet.' : '暂无视频内容。'}</p>
          )}
          <div className="flex-actions video-pagination">
            <button
              className="btn"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              {en ? 'Previous' : '上一页'}
            </button>
            <span>
              {result.page || 1} / {result.pages || 1}
            </span>
            <button
              className="btn"
              disabled={filters.page >= (result.pages || 1)}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
            >
              {en ? 'Next' : '下一页'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="video-watch-layout">
            <section>
              {episode ? (
                <>
                  <Player key={episode.id} episode={episode} lang={lang} />
                  <h2>{t(episode, 'title')}</h2>
                  <ContentInteractions key={episode.id} kind="video" id={episode.id} en={en} />
                  <p>{t(episode, 'summary')}</p>
                  <RichView doc={displayVideoBody(t(episode, 'body'))}/>
                  <div className="flex-actions">
                    <button
                      className="btn"
                      disabled={index === 0}
                      onClick={() => setSelected(result.episodes[index - 1].id)}
                    >
                      <ArrowLeft size={16} />
                      {en ? 'Previous episode' : '上一集'}
                    </button>
                    <button
                      className="btn"
                      disabled={index >= result.episodes.length - 1}
                      onClick={() => setSelected(result.episodes[index + 1].id)}
                    >
                      {en ? 'Next episode' : '下一集'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <p role="status" className="notice">
                  {en ? 'Episodes coming soon.' : '视频更新中，敬请期待。'}
                </p>
              )}
            </section>
            <aside className="video-episode-list">
              <h2>{en ? 'Episodes' : '选集'}</h2>
              {result.episodes?.map((ep: any, i: number) => (
                <button
                  key={ep.id}
                  className={selected === ep.id ? 'active' : ''}
                  onClick={() => setSelected(ep.id)}
                >
                  {ep.imageId && (
                    <img
                      className="video-episode-cover"
                      src={'/api/media/' + ep.imageId}
                      alt=""
                    />
                  )}
                  <span className="episode-number">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>
                    {t(ep, 'title')}
                    <small>
                      {Math.max(1, Math.ceil(ep.duration / 60))}{' '}
                      {en ? 'min' : '分钟'} ·{' '}
                      {ep.preview
                        ? en
                          ? 'Preview'
                          : '试看'
                        : en
                          ? 'Sign in to watch'
                          : '登录观看'}
                    </small>
                  </span>
                  {ep.preview ? <Play size={16} /> : <Lock size={16} />}
                </button>
              ))}
            </aside>
          </div>
          <section className="video-series-about">
            <h2>{en ? 'About this series' : '系列介绍'}</h2>
            <RichView doc={displayVideoBody(t(result.series, 'body'))}/>
          </section>
        </>
      )}
    </section>
  );
}
