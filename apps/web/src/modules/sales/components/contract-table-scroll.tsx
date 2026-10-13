'use client';
import { useEffect, useRef, type ReactNode } from 'react';

export function ContractTableScroll({ children }: { children: ReactNode }) {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const upper = top.current,
      lower = bottom.current;
    if (!upper || !lower) return;
    const measure = () => {
      const spacer = upper.firstElementChild as HTMLElement | null;
      if (spacer) spacer.style.width = lower.scrollWidth + 'px';
      upper.scrollLeft = lower.scrollLeft;
    };
    const syncTop = () => {
      if (lower.scrollLeft !== upper.scrollLeft)
        lower.scrollLeft = upper.scrollLeft;
    };
    const syncBottom = () => {
      if (upper.scrollLeft !== lower.scrollLeft)
        upper.scrollLeft = lower.scrollLeft;
    };
    upper.addEventListener('scroll', syncTop, { passive: true });
    lower.addEventListener('scroll', syncBottom, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(lower);
    if (lower.firstElementChild) observer?.observe(lower.firstElementChild);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      upper.removeEventListener('scroll', syncTop);
      lower.removeEventListener('scroll', syncBottom);
    };
  }, []);
  return (
    <>
      <div
        ref={top}
        dir="rtl"
        className="h-5 overflow-x-auto overflow-y-hidden border-b border-border"
        role="region"
        aria-label="اسکرول افقی بالای جدول قراردادها"
        tabIndex={0}
      >
        <div style={{ width: 0, height: 1 }} />
      </div>
      <div
        ref={bottom}
        dir="rtl"
        className="overflow-x-auto"
        role="region"
        aria-label="جدول قراردادها و اسکرول افقی پایین"
        tabIndex={0}
      >
        {children}
      </div>
    </>
  );
}
