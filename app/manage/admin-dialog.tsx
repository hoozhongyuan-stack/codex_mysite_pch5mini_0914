'use client';

import * as React from 'react';
import {
  Dialog as BaseDialog,
  DialogContent as BaseDialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { shouldConfirmDialogClose, updateDraftScopes } from './dialog-change-guard';

const ChangeContext = React.createContext<{ markChanged: (scope?: string) => void; markSaved: (scope: string) => void } | null>(null);

/** User dismissal is guarded; controlled successful save/close is never intercepted. */
export function Dialog({ onOpenChange, onOpenChangeComplete, open, guardChanges = true, changeRevision = 0, ...props }:
  React.ComponentProps<typeof BaseDialog> & { guardChanges?: boolean; changeRevision?: number }) {
  const dirty = React.useRef<string[]>([]);
  const previousRevision = React.useRef(changeRevision);
  React.useEffect(() => {
    if (guardChanges && previousRevision.current !== changeRevision) dirty.current = updateDraftScopes(dirty.current, 'draft', false);
    previousRevision.current = changeRevision;
  }, [changeRevision, guardChanges]);
  React.useEffect(() => { if (!open) dirty.current = []; }, [open]);
  const markChanged = React.useCallback((scope = 'draft') => { if (guardChanges) dirty.current = updateDraftScopes(dirty.current, scope, false); }, [guardChanges]);
  const markSaved = React.useCallback((scope: string) => { dirty.current = updateDraftScopes(dirty.current, scope, true); }, []);
  return <ChangeContext.Provider value={React.useMemo(() => ({markChanged, markSaved}), [markChanged, markSaved])}>
    <BaseDialog {...props} open={open} onOpenChangeComplete={next => {
      if (!next) dirty.current = [];
      onOpenChangeComplete?.(next);
    }} onOpenChange={(next, details) => {
      if (shouldConfirmDialogClose(dirty.current.length > 0, next, details.reason) &&
          !window.confirm('有未保存的修改，确定放弃并关闭？')) {
        details.cancel();
        return;
      }
      onOpenChange?.(next, details);
    }} />
  </ChangeContext.Provider>;
}

/** Increment only from user edit callbacks, never from initial fetch/open/save. */
export function useDialogChangeRevision() {
  return React.useReducer((revision: number) => revision + 1, 0);
}

/** Clear only the fields actually persisted; unrelated edits remain protected. */
export function useAdminDialogSaved(scope = 'draft') {
  const markSaved = React.useContext(ChangeContext)?.markSaved;
  return React.useCallback(() => markSaved?.(scope), [markSaved, scope]);
}

export type AdminDialogSize = 'sm' | 'md' | 'lg' | 'editor' | 'media';
export function DialogContent({ size = 'md', className, onInputCapture, onChangeCapture, showCloseButton = true, children, ...props }:
  React.ComponentProps<typeof BaseDialogContent> & { size?: AdminDialogSize }) {
  const markChanged = React.useContext(ChangeContext)?.markChanged;
  const fieldChanged = React.useCallback((event: Event) => {
    // Native custom events stay within their own popup, including nested pickers.
    if ((event.target as Element)?.closest('[data-admin-dialog-size]') === event.currentTarget) markChanged?.((event.target as Element).closest('[data-admin-draft-scope]')?.getAttribute('data-admin-draft-scope') || 'draft');
  }, [markChanged]);
  const popup = React.useRef<HTMLDivElement | null>(null);
  const attachPopup = React.useCallback((node: HTMLDivElement | null) => {
    popup.current?.removeEventListener('admin:field-change', fieldChanged);
    popup.current = node;
    node?.addEventListener('admin:field-change', fieldChanged);
  }, [fieldChanged]);
  const changed = (event: React.SyntheticEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest('[data-admin-dialog-size]') === event.currentTarget &&
        target.closest('form, [data-admin-edit]')) markChanged?.(target.closest('[data-admin-draft-scope]')?.getAttribute('data-admin-draft-scope') || 'draft');
  };
  return <BaseDialogContent {...props} showCloseButton={false} ref={attachPopup} className={cn('admin-dialog', className)}
    data-admin-dialog-size={size}
    onInputCapture={event => { changed(event); onInputCapture?.(event); }}
    onChangeCapture={event => { changed(event); onChangeCapture?.(event); }}>{children}{showCloseButton && <DialogClose render={<button type="button" className="admin-dialog-close" aria-label="关闭" />}><X size={18} aria-hidden="true"/></DialogClose>}</BaseDialogContent>;
}

/** Common footer keeps cancel first and uses the same dismissal guard as Escape/X. */
export function AdminFormActions({ children, busy = false, showCancel = true, className, ...props }:
  React.ComponentProps<'div'> & { busy?: boolean; showCancel?: boolean }) {
  return <div {...props} className={cn('admin-form-actions', className)}>
    {showCancel && <DialogClose render={<button type="button" className="btn" disabled={busy} aria-label="取消" />}>取消</DialogClose>}
    {children}
  </div>;
}

export { DialogClose, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogOverlay, DialogPortal, DialogTrigger };
