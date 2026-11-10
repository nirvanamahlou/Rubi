'use client';

import { useEffect, useRef } from 'react';

/** Live previews are current reads; background refresh never creates an execution record. */
export function subscribeReportRefresh(
  refresh: () => void,
  intervalMs = 15000,
) {
  const visibleRefresh = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  const timer = window.setInterval(visibleRefresh, intervalMs);
  window.addEventListener('focus', visibleRefresh);
  document.addEventListener('visibilitychange', visibleRefresh);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('focus', visibleRefresh);
    document.removeEventListener('visibilitychange', visibleRefresh);
  };
}

export function useReportLiveRefresh(
  enabled: boolean,
  revision: string,
  refresh: (changed?: boolean) => void,
  delayMs = 0,
) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useEffect(() => {
    if (!enabled) return;
    // A changed filter/sort/report replaces the previous result, not just its label.
    let frame: number | undefined;
    const schedule = () => {
      frame = window.requestAnimationFrame(() => latest.current(true));
    };
    const timer = delayMs ? window.setTimeout(schedule, delayMs) : undefined;
    if (!delayMs) schedule();
    const unsubscribe = subscribeReportRefresh(() => latest.current());
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled, revision, delayMs]);
}
