'use client';
import SiteLink from '../components/site-link';


import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Image as ImageIcon,
  MessageCircle,
  Phone,
  ClipboardList,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PublicForm } from '@/app/public-client';
import './floating-entries.css';

export type FloatingEntry = {
  id: string;
  labelZh: string;
  labelEn?: string;
  icon?: 'message' | 'phone' | 'image' | 'form';
  iconUrl?: string;
  kind: 'image' | 'phone' | 'form';
  imageId?: string;
  imageUrl?: string;
  phone?: string;
  formId?: string;
  formHref?: string;
  form?: { fields?: any[]; updatedAt?: string; privacyVersion?: number };
  enabled: boolean;
  ends: Array<'pc' | 'h5' | 'mini'>;
  pages?: string[];
};

function localHref(value?: string) {
  return (
    !!value &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
  );
}
function imageHref(value?: string) {
  return !!value && (localHref(value) || /^https:\/\//i.test(value));
}
function valid(entry: FloatingEntry) {
  if (entry.kind === 'phone')
    return /^\+?[\d ()-]{3,30}$/.test(entry.phone || '');
  if (entry.kind === 'image') return imageHref(entry.imageUrl);
  return (
    entry.kind === 'form' &&
    !!entry.formId &&
    localHref(entry.formHref) &&
    !!entry.form
  );
}

export default function FloatingEntries({
  entries,
  lang,
}: {
  entries?: FloatingEntry[];
  lang: string;
}) {
  const pathname = usePathname();
  const en = lang === 'en';
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [obscured, setObscured] = useState(false);
  const [selected, setSelected] = useState<FloatingEntry | null>(null);
  const [copyState, setCopyState] = useState('');
  const [loaded, setLoaded] = useState<FloatingEntry[]>([]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const check = () => {
      const focused = document.activeElement;
      const editing =
        focused instanceof HTMLElement &&
        focused.matches('input, textarea, select, [contenteditable="true"]');
      const dialog = document.querySelector(
        '[role="dialog"], [role="alertdialog"], [data-floating-hide="true"]',
      );
      setObscured(!!document.fullscreenElement || editing || !!dialog);
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'data-floating-hide'],
    });
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', check);
    document.addEventListener('fullscreenchange', check);
    check();
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', check);
      document.removeEventListener('fullscreenchange', check);
    };
  }, []);

  useEffect(() => {
    if (entries || mobile === null) return;
    const controller = new AbortController();
    setLoaded([]);
    fetch(
      `/api/channel-config?end=${mobile ? 'h5' : 'pc'}&lang=${encodeURIComponent(lang)}`,
      { signal: controller.signal },
    )
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error('Configuration unavailable')),
      )
      .then((data: any) =>
        setLoaded(Array.isArray(data.floating) ? data.floating : []),
      )
      .catch((error) => {
        if (error.name !== 'AbortError') setLoaded([]);
      });
    return () => controller.abort();
  }, [entries, mobile, lang]);

  useEffect(() => {
    setSelected(null);
    setCopyState('');
  }, [pathname]);
  const end = mobile ? 'h5' : 'pc';
  const page = pathname.replace(/^\/(zh|en)(?=\/|$)/, '') || '/';
  const visible = (entries || loaded)
    .filter(
      (entry) =>
        entry.enabled &&
        entry.ends?.includes(end) &&
        (!entry.pages?.length || entry.pages.includes(page)) &&
        valid(entry),
    )
    .slice(0, 3);
  const hidden =
    mobile === null ||
    obscured ||
    !!selected ||
    /\/(checkout|payment)(\/|$)/.test(pathname);
  const label = (entry: FloatingEntry) =>
    en ? entry.labelEn || entry.labelZh : entry.labelZh;
  const icons = {
    message: MessageCircle,
    phone: Phone,
    image: ImageIcon,
    form: ClipboardList,
  };

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(selected?.phone || '');
      setCopyState(en ? 'Copied' : '已复制');
    } catch {
      setCopyState(
        en ? 'Select and copy the number above.' : '请选中上方号码复制。',
      );
    }
  }

  function formHref(entry: FloatingEntry) {
    const url = new URL(entry.formHref!, window.location.origin);
    url.searchParams.set('sourceEnd', end);
    url.searchParams.set('sourcePage', pathname);
    return url.pathname + url.search;
  }

  return (
    <>
      {!hidden && visible.length > 0 && (
        <aside
          className="floating-entries"
          aria-label={en ? 'Quick contact' : '快捷联系'}
        >
          {visible.map((entry) => {
            const Icon = icons[entry.icon || entry.kind];
            const content = (
              <>
                {imageHref(entry.iconUrl) ? (
                  <img src={entry.iconUrl} alt="" />
                ) : (
                  <Icon size={21} aria-hidden="true" />
                )}
                <span>{label(entry)}</span>
              </>
            );
            if (mobile && entry.kind === 'phone')
              return (
                <SiteLink
                  key={entry.id}
                  className="floating-entry"
                  href={'tel:' + entry.phone!.replace(/[ ()-]/g, '')}
                >
                  {content}
                </SiteLink>
              );
            if (mobile && entry.kind === 'form')
              return (
                <SiteLink
                  key={entry.id}
                  className="floating-entry"
                  href={formHref(entry)}
                >
                  {content}
                </SiteLink>
              );
            return (
              <button
                key={entry.id}
                type="button"
                className="floating-entry"
                aria-haspopup="dialog"
                onClick={() => {
                  setSelected(entry);
                  setCopyState('');
                }}
              >
                {content}
              </button>
            );
          })}
        </aside>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          className={
            'floating-entry-dialog' +
            (selected?.kind === 'form' ? ' floating-entry-form' : '')
          }
        >
          <DialogHeader>
            <DialogTitle>{selected ? label(selected) : ''}</DialogTitle>
            <DialogDescription>
              {selected?.kind === 'image'
                ? en
                  ? 'Scan or view the image below.'
                  : '请查看或扫描下方图片。'
                : selected?.kind === 'phone'
                  ? en
                    ? 'Contact us by phone.'
                    : '欢迎通过电话联系我们。'
                  : en
                    ? 'Complete the form below.'
                    : '请填写下方表单。'}
            </DialogDescription>
          </DialogHeader>
          {selected?.kind === 'image' && (
            <img
              className="floating-action-image"
              src={selected.imageUrl}
              alt={label(selected)}
            />
          )}
          {selected?.kind === 'phone' && (
            <div className="floating-phone">
              <p>{selected.phone}</p>
              <button type="button" onClick={copyPhone}>
                {en ? 'Copy number' : '复制号码'}
              </button>
              <span role="status">{copyState}</span>
            </div>
          )}
          {selected?.kind === 'form' && selected.form && (
            <div
              data-floating-source-end={end}
              data-floating-source-page={pathname}
            >
              <PublicForm
                formId={selected.formId!}
                en={en}
                fields={selected.form.fields}
                formVersion={selected.form.updatedAt}
                privacyVersion={selected.form.privacyVersion}
                sourceEnd={end}
                sourcePage={pathname}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
