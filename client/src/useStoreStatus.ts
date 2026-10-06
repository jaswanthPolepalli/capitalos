import { useEffect, useState } from 'react';
import * as Store from './store';

let users = 0;
let stop: (() => void) | undefined;
function watchFreshness() {
  users++;
  if (users === 1) {
    let lastAttempt = 0;
    const refresh = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastAttempt < 1000) return;
      lastAttempt = Date.now();
      void Store.loadAll();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 60000);
    stop = () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
    refresh();
  }
  return () => { if (--users === 0) { stop?.(); stop = undefined; } };
}
export function useStoreStatus() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = Store.subscribe(() => setTick(t => t + 1));
    const unwatch = watchFreshness();
    const clock = window.setInterval(() => setTick(t => t + 1), 15000);
    return () => { unsubscribe(); unwatch(); window.clearInterval(clock); };
  }, []);
  return { tick, ...Store.getLoadState(), refresh: Store.loadAll };
}
