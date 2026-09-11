'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Fit the A4 preview to the modal; the separate print copy stays at native size. */
export function DocumentPreview({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () =>
      setScale(
        Math.min(1, Math.max(1, element.clientWidth) / ((210 * 96) / 25.4)),
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={container}
      dir="ltr"
      data-document-preview
      className="w-full min-w-0 overflow-hidden rounded border border-border bg-white"
    >
      <div style={{ width: '210mm', zoom: scale, marginInline: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
