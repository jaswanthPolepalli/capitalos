import { useEffect, useRef } from 'react';
import { useStoreStatus } from '../useStoreStatus';
import { useToast } from './Toast';

const SESSION_KEY = 'capitalos:refresh-notice-shown';

/** One short acknowledgement per tab session, never on every route or poll. */
export function DataRefreshNotice() {
  const { status, hasData, isStale } = useStoreStatus();
  const { addToast } = useToast();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || status !== 'ready' || !hasData || isStale) return;
    shown.current = true;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, 'true');
    } catch { /* Storage restrictions should not prevent loading the app. */ }
    addToast('Records refreshed.', 'success', 3000);
  }, [status, hasData, isStale, addToast]);
  return null;
}
