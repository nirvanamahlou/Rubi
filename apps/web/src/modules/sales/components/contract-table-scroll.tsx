'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ScrollPosition = Pick<HTMLElement, 'scrollLeft'>;

export function syncContractTableScroll(
  source: ScrollPosition,
  target: ScrollPosition | null,
) {
  if (target && target.scrollLeft !== source.scrollLeft)
    target.scrollLeft = source.scrollLeft;
}

export function ContractTableScroll({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const topScroll = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const measure = () => {
      const element = viewport.current;
      if (!element) return;
      setWidth(element.scrollWidth);
      setOverflow(element.scrollWidth > element.clientWidth + 1);
      syncContractTableScroll(element, topScroll.current);
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    if (viewport.current) observer?.observe(viewport.current);
    if (content.current) observer?.observe(content.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  function move(direction: -1 | 1) {
    const element = viewport.current;
    if (element)
      element.scrollBy({
        left: direction * Math.max(240, element.clientWidth * 0.7),
        behavior: 'smooth',
      });
  }

  return (
    <>
      <div
        hidden={!overflow}
        className="sticky top-20 z-20 rounded-t-2xl border-b border-border bg-surface px-3 py-2 shadow-sm sm:top-14"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            حرکت بین ستون‌های قرارداد
          </span>
          <div className="flex gap-1" dir="ltr">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="اسکرول جدول به چپ"
              onClick={() => move(-1)}
            >
              <ArrowLeft className="size-4" />
              چپ
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="اسکرول جدول به راست"
              onClick={() => move(1)}
            >
              راست
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
        <div
          ref={topScroll}
          dir="rtl"
          aria-hidden="true"
          className="mt-1 h-5 overflow-x-auto overflow-y-hidden"
          onScroll={(event) =>
            syncContractTableScroll(event.currentTarget, viewport.current)
          }
        >
          <div style={{ width, height: 1 }} />
        </div>
      </div>
      <div
        ref={viewport}
        dir="rtl"
        tabIndex={0}
        role="region"
        aria-label="جدول قراردادها؛ برای حرکت افقی از کلیدهای جهت‌نما استفاده کنید"
        className="overflow-x-auto rounded-b-2xl focus-visible:outline-2 focus-visible:outline-primary"
        onScroll={(event) =>
          syncContractTableScroll(event.currentTarget, topScroll.current)
        }
      >
        <div ref={content} className="w-max min-w-full">
          {children}
        </div>
      </div>
    </>
  );
}
