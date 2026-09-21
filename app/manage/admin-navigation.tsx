'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { patchAdminQuery, adminTrail } from '@/lib/admin-navigation.mjs';

const eventName = 'admin:navigate';
export function navigateAdmin(values: Record<string, string | number>, replace = false) {
  if (!window.dispatchEvent(new CustomEvent('admin:before-navigate', {cancelable:true, detail:values}))) return false;
  const url = window.location.pathname + patchAdminQuery(window.location.search, values);
  if (replace) window.history.replaceState(window.history.state, '', url);
  else window.history.pushState(window.history.state, '', url);
  window.dispatchEvent(new Event(eventName));
  return true;
}
export function useAdminSearch() {
  const [search, setSearch] = useState('');
  useEffect(() => {
    const read = () => setSearch(window.location.search);
    read();
    window.addEventListener('popstate', read);
    window.addEventListener(eventName, read);
    return () => {
      window.removeEventListener('popstate', read);
      window.removeEventListener(eventName, read);
    };
  }, []);
  return search;
}
export function useAdminTab(key: string, initial: string, allowed: string[]) {
  const search = useAdminSearch();
  const requested = new URLSearchParams(search).get(key);
  const tab = requested && allowed.includes(requested) ? requested : initial;
  const setTab = useCallback((value: string) => navigateAdmin({ [key]: value }), [key]);
  return [tab, setTab] as const;
}
/** Detail stays in the same workspace; browser Back and breadcrumb use the same state. */
export function useAdminDetail<T>(key: string, load: (id: string) => Promise<T>) {
  const search = useAdminSearch();
  const id = new URLSearchParams(search).get(key) || '';
  const [state, setState] = useState<{id: string; value: T | null; error: string}>({id:'',value:null,error:''});
  const currentId = useRef(id);
  const loader = useRef(load);
  useEffect(() => { currentId.current = id; loader.current = load; }, [id, load]);
  useEffect(() => {
    let current = true;
    if (!id) return;
    loader.current(id).then(value => { if(current) setState({id,value,error:''}); })
      .catch(e => { if(current) setState({id,value:null,error:e.message || '详情加载失败'}); });
    return () => { current = false; };
  }, [id]);
  const open = (next: string) => {
    sessionStorage.setItem('admin-scroll:' + key, String(window.scrollY));
    if (navigateAdmin({[key]:next})) window.scrollTo(0, 0);
  };
  const close = () => {
    if (!navigateAdmin({[key]:''})) return;
    requestAnimationFrame(() => window.scrollTo(0, Number(sessionStorage.getItem('admin-scroll:' + key) || 0)));
  };
  const setValue = (value: T | null) => setState({id, value, error:''});
  const retry = async () => {
    if (!id) return;
    setState({id:'',value:null,error:''});
    try { const value=await loader.current(id); if(currentId.current===id) setState({id,value,error:''}); }
    catch(e: unknown) { if(currentId.current===id) setState({id,value:null,error:e instanceof Error?e.message:'详情加载失败'}); }
  };
  return {value:state.id===id ? state.value : null,id,loading:!!id&&state.id!==id,error:state.id===id?state.error:'',open,close,setValue,retry};
}
export function AdminTrail({view}: {view:string}) {
  const search = useAdminSearch();
  return <>{(adminTrail(view, search) as {label:string;reset:Record<string,string>}[]).map((part, index, trail) => <span key={index} className="admin-trail-part"><span aria-hidden="true">/</span>{index < trail.length - 1 ? <button onClick={()=>navigateAdmin(part.reset)}>{part.label}</button> : <span aria-current="page">{part.label}</span>}</span>)}</>;
}

/** Shared page-level guard. Register only against an actual edited draft. */
export function useAdminUnsavedChanges(dirty: boolean, retainedDraftKeys: string[] = []) {
  const dirtyRef = useRef(dirty);
  const retained = useRef(retainedDraftKeys);
  useEffect(() => { dirtyRef.current = dirty; retained.current = retainedDraftKeys; }, [dirty, retainedDraftKeys]);
  useEffect(() => {
    const confirmLeave = () => !dirtyRef.current || window.confirm('有未保存的修改，确定离开？');
    const before = (event: Event) => {
      const keys = Object.keys((event as CustomEvent).detail || {});
      if (keys.length && keys.every(key => retained.current.includes(key))) return;
      if (!confirmLeave()) event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || link.target === '_blank') return;
      if (link.href !== window.location.href && !confirmLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current) {event.preventDefault();} };
    window.addEventListener('admin:before-navigate', before);
    document.addEventListener('click', click, true);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('admin:before-navigate', before);
      document.removeEventListener('click', click, true);
      window.removeEventListener('beforeunload', unload);
    };
  }, []);
}
