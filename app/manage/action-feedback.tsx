'use client';

import {useEffect} from 'react';

/** Compact, accessible outcome feedback for management actions. */
export default function ActionFeedback({message, tone = 'success', clear}: {message: string; tone?: 'success'|'error'|'info'; clear?: () => void}) {
  useEffect(() => {
    if (!message || tone !== 'success' || !clear) return;
    const timer = window.setTimeout(clear, 3500);
    return () => window.clearTimeout(timer);
  }, [message, tone, clear]);
  if (!message) return null;
  return <p className={'action-feedback '+tone} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">{message}</p>;
}
