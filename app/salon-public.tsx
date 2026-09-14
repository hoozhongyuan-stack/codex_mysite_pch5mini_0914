'use client';
import SiteLink from '../components/site-link';

import ContentInteractions from '@/app/content-interactions';
import { useEffect, useState } from 'react';
import { RichView } from '@/lib/rich-view';
export default function SalonPublic({
  lang,
  id,
  initialEvent,
  initialError, initialList=null, embedded=false,
}: any) {
  const en = lang === 'en',
    t = (zh: string, eng: string) => (en ? eng : zh);
  const [event] = useState(initialEvent),
    [rows, setRows] = useState<any[]>(initialList?.rows || []),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(initialList?.pages || 1),
    [user, setUser] = useState<any>(null),
    [registration, setRegistration] = useState<any>(null),
    [answers, setAnswers] = useState<any>({}),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(initialError),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!initialList && !initialEvent),
    [code, setCode] = useState('');
  async function api(action: string, data: any = {}, write = false) {
    const r = await fetch(
      '/api/marketing/' +
        action +
        (write ? '' : '?' + new URLSearchParams(data)),
      write
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }
        : undefined,
    );
    const d = (await r.json()) as any;
    if (!r.ok) throw Error(d.error);
    return d;
  }
  useEffect(() => {
    setLoading(true);
    fetch('/api/visitor/session')
      .then((r) => r.json())
      .then(async (d: any) => {
        setUser(d.user);
        setAnswers({
          name: d.user
            ? `${d.user.lastName || ''} ${d.user.firstName || ''}`.trim()
            : '',
          email: d.user?.email || '',
        });
        if (id && id !== 'mine' && d.user)
          setRegistration((await api('registration', { id })).registration);
        if (!id || id === 'mine') {
          const result = await api(id === 'mine' ? 'mine' : 'list', { page });
          setRows(result.rows);
          setPages(result.pages);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    setCode(new URLSearchParams(location.search).get('checkin') || '');
  }, [id, page]);
  const run = async (action: string) => {
    setBusy(true);
    setError('');
    try {
      const d = await api(action, { id, answers, consent, code }, true);
      setRegistration(d.registration);
      setMessage(t('操作成功', 'Saved'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const upload = async (f: any, file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.set('eventId', id);
      body.set('fieldId', f.id);
      body.set('file', file);
      const r = await fetch('/api/form-upload', { method: 'POST', body });
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      setAnswers((a: any) => ({
        ...a,
        [f.id]: '/api/submission-file/' + d.id,
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const login = () => {
    const back = location.pathname + location.search;
    location.href = `/${lang}/account?returnTo=${encodeURIComponent(back)}`;
  };
  const canRegister =
    event &&
    event.status === 'published' &&
    Date.now() >= Date.parse(event.registrationStarts) &&
    Date.now() < Date.parse(event.registrationEnds) &&
    event.remaining !== 0;
  const time = (v: string) =>
    new Date(v).toLocaleString(en ? 'en-US' : 'zh-CN', {
      timeZone: event?.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <section
      className={embedded?"member-business salon-page":"public-section salon-page"}
      style={embedded?{}:{ maxWidth: 1120, margin: 'auto', padding: '48px 24px' }}
    >
      <nav className="flex-actions">
        <SiteLink href={`/${lang}/events`}>{t('沙龙活动', 'Events')}</SiteLink>
        <SiteLink href={`/${lang}/events/mine`}>{t('我的活动', 'My events')}</SiteLink>
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {loading && !event ? (
        <p>{t('正在加载…', 'Loading…')}</p>
      ) : !id || id === 'mine' ? (
        <>
          <h1>
            {id === 'mine' ? t('我的活动', 'My events') : t('沙龙会', 'Salons')}
          </h1>
          {id === 'mine' && !user && (
            <button className="btn" onClick={login}>
              {t('请先登录', 'Sign in')}
            </button>
          )}
          <div className="field-grid">
            {rows.map((r: any) => {
              const e = r.event || r;
              return (
                <article className="panel" key={r.id} style={{ padding: 24 }}>
                  {e.imageId && (
                    <img
                      src={'/api/media/' + e.imageId}
                      alt=""
                      style={{
                        width: '100%',
                        aspectRatio: '16/9',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                  <h2>{en ? e.titleEn : e.titleZh}</h2>
                  <p>
                    {new Date(e.starts).toLocaleString()} ·{' '}
                    {en ? e.locationEn : e.locationZh}
                  </p>
                  {e.test && <p>{t('测试活动', 'Test event')}</p>}
                  {r.event && (
                    <p>
                      {r.status === 'cancelled'
                        ? t('已取消', 'Cancelled')
                        : r.checkedAt
                          ? t('已签到', 'Checked in')
                          : t('已报名', 'Registered')}
                    </p>
                  )}
                  <SiteLink className="btn" href={`/${lang}/events/${e.id}`}>
                    {t('查看活动', 'View event')} →
                  </SiteLink>
                </article>
              );
            })}
          </div>
          {!rows.length && <p>{t('暂无活动记录', 'No events')}</p>}
          <div className="flex-actions">
            <button
              className="btn"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t('上一页', 'Previous')}
            </button>
            {page} / {pages}
            <button
              className="btn"
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
            >
              {t('下一页', 'Next')}
            </button>
          </div>
        </>
      ) : (
        event && (
          <>
            <h1 style={{ marginTop: 32 }}>
              {en ? event.titleEn : event.titleZh}
            </h1>
            {event.test && (
              <p role="status" className="notice">
                {t(
                  '测试活动，仅供沙箱账号体验',
                  'Test event for sandbox accounts',
                )}
              </p>
            )}
            {event.imageId && (
              <img
                src={'/api/media/' + event.imageId}
                alt={en ? event.titleEn : event.titleZh}
                style={{
                  width: '100%',
                  maxHeight: 420,
                  objectFit: 'cover',
                  borderRadius: 16,
                }}
              />
            )}
            <ContentInteractions kind="salon" id={event.id} en={en} />
            <p className="salon-summary">
              {en ? event.summaryEn : event.summaryZh}
            </p>
            <span className="pill green">
              {Date.now() >= Date.parse(event.ends)
                ? t('活动已结束', 'Event ended')
                : event.remaining === 0
                  ? t('名额已满', 'Fully booked')
                  : canRegister
                    ? t('报名开放中', 'Registration open')
                    : t('报名未开放', 'Registration closed')}
            </span>
            <div className="salon-facts">
              <p>
                <small>{t('活动时间', 'When')}</small>
                {time(event.starts)} — {time(event.ends)}
                <small>{event.timezone}</small>
              </p>
              <p>
                <small>{t('活动地点', 'Where')}</small>
                {en ? event.locationEn : event.locationZh} ·{' '}
                {en ? event.addressEn : event.addressZh}
              </p>
              <p>
                <small>{t('主办与联系', 'Organizer & contact')}</small>
                {event.organizer} · {event.contact} {event.phone}
              </p>
              <p>
                {t('剩余名额', 'Places remaining')}:{' '}
                {event.remaining ?? t('不限', 'Unlimited')}
              </p>
              <p>
                {t('报名截止', 'Registration closes')}:{' '}
                {time(event.registrationEnds)}
              </p>
              <p>
                {t('签到时间', 'Check-in')}: {time(event.checkinStarts)} —{' '}
                {time(event.checkinEnds)}
              </p>
            </div>
            <div className="salon-layout">
              <div className="rich-content salon-body">
                <h2>{t('活动介绍', 'About this event')}</h2>
                <RichView doc={en ? event.bodyEn : event.bodyZh} />
              </div>
              <section
                className="panel salon-registration"
                id="salon-registration"
              >
                <h2>
                  {code
                    ? t('活动签到', 'Event check-in')
                    : t('活动报名', 'Registration')}
                </h2>
                {!user ? (
                  <button className="btn primary" onClick={login}>
                    {t('登录后继续', 'Sign in to continue')}
                  </button>
                ) : code ? (
                  <>
                    <p>
                      {registration?.checkedAt
                        ? t('已签到，时间：', 'Checked in at: ') +
                          time(registration.checkedAt)
                        : registration?.status === 'active'
                          ? t(
                              '确认到场后点击下方按钮。',
                              'Confirm your attendance below.',
                            )
                          : t(
                              '请先完成报名再签到。',
                              'Please register before checking in.',
                            )}
                    </p>
                    <button aria-busy={Boolean(busy)}
                      className="btn primary"
                      disabled={
                        busy ||
                        registration?.status !== 'active' ||
                        !!registration?.checkedAt
                      }
                      onClick={() => run('checkin')}
                    >
                      {t('确认签到', 'Confirm check-in')}
                    </button>
                    <SiteLink className="btn" href={`/${lang}/events/${id}`}>
                      {t('查看报名', 'View registration')}
                    </SiteLink>
                  </>
                ) : registration?.status === 'active' ? (
                  <>
                    <p>
                      {t('报名成功，编号：', 'Registered. Reference: ')}
                      {registration.id}
                    </p>
                    {registration.checkedAt ? (
                      <p>
                        {t('签到时间：', 'Checked in: ')}
                        {time(registration.checkedAt)}
                      </p>
                    ) : (
                      <p>
                        {t(
                          '请在活动签到时段扫描现场签到码。',
                          'Scan the event QR code during check-in hours.',
                        )}
                      </p>
                    )}
                    {event.allowCancel && !registration.checkedAt && (
                      <button aria-busy={Boolean(busy)}
                        className="btn"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              t('确认取消报名？', 'Cancel your registration?'),
                            )
                          )
                            run('cancel');
                        }}
                      >
                        {t('取消报名', 'Cancel registration')}
                      </button>
                    )}
                  </>
                ) : !canRegister ? (
                  <p>
                    {event.remaining === 0
                      ? t('名额已满', 'Event full')
                      : t('当前未开放报名', 'Registration is currently closed')}
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run('register');
                    }}
                  >
                    {event.fields.map((f: any) => (
                      <label className="field" key={f.id}>
                        <span>
                          {f.required && <b className="required-mark">*</b>}
                          {en ? f.labelEn : f.labelZh}
                        </span>
                        {f.type === 'image' ? (
                          <>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              required={f.required && !answers[f.id]}
                              onChange={(e) => upload(f, e.target.files?.[0])}
                            />
                            {answers[f.id] && (
                              <small>{t('图片已上传', 'Image uploaded')}</small>
                            )}
                          </>
                        ) : f.type === 'textarea' ? (
                          <textarea
                            required={f.required}
                            maxLength={2000}
                            value={answers[f.id] || ''}
                            onChange={(e) =>
                              setAnswers({ ...answers, [f.id]: e.target.value })
                            }
                          />
                        ) : (
                          <input
                            required={f.required}
                            type={
                              f.type === 'phone'
                                ? 'tel'
                                : f.type === 'image'
                                  ? 'text'
                                  : f.type
                            }
                            maxLength={2000}
                            value={answers[f.id] || ''}
                            onChange={(e) =>
                              setAnswers({ ...answers, [f.id]: e.target.value })
                            }
                          />
                        )}
                      </label>
                    ))}
                    <label>
                      <input
                        type="checkbox"
                        required
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <b className="required-mark">*</b>
                      {t(
                        '同意主办方使用以上信息处理报名、签到及活动通知。',
                        'I agree to the organizer using these details for registration, check-in and event notices.',
                      )}
                    </label>
                    <button aria-busy={Boolean(busy)}
                      className="btn primary"
                      style={{ display: 'block', marginTop: 20 }}
                      disabled={busy}
                    >
                      {busy
                        ? t('提交中…', 'Submitting…')
                        : t('确认报名', 'Register')}
                    </button>
                  </form>
                )}
              </section>
            </div>
            <SiteLink
              className="salon-mobile-action btn primary"
              href="#salon-registration"
            >
              {registration?.status === 'active'
                ? t('查看我的报名', 'View registration')
                : t('查看报名', 'Registration')}
            </SiteLink>
          </>
        )
      )}
    </section>
  );
}
