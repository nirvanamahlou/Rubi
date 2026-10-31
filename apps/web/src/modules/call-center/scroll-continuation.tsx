import { useEffect, useRef } from 'react';

/** Incremental continuation; no page navigation controls in the dossier. */
export function ScrollContinuation({
  enabled,
  onMore,
}: {
  enabled: boolean;
  onMore: () => void;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const action = useRef(onMore);
  const requested = useRef(false);
  useEffect(() => {
    action.current = onMore;
  }, [onMore]);
  useEffect(() => {
    if (!enabled || !marker.current) return;
    requested.current = false;
    const observer = new IntersectionObserver((entries) => {
      if (!requested.current && entries.some((entry) => entry.isIntersecting)) {
        requested.current = true;
        action.current();
      }
    });
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, [enabled]);
  return enabled ? (
    <div
      ref={marker}
      tabIndex={0}
      aria-label="بارگذاری موارد بیشتر"
      onFocus={() => {
        if (!requested.current) {
          requested.current = true;
          action.current();
        }
      }}
      style={{ minHeight: 1 }}
    />
  ) : null;
}
