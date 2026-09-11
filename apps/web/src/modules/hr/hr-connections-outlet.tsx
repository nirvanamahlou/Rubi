'use client';
import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { hrConnectionModule } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { useHrConnectionsHidden } from './hr-connections-visibility';

const Workspace = dynamic(
  () =>
    import('./hr-connections-workspace').then((m) => m.HrConnectionsWorkspace),
  {
    loading: () => <p role="status">در حال دریافت ارتباطات منابع انسانی…</p>,
  },
);
export function HrConnectionsOutlet() {
  const hidden = useHrConnectionsHidden();
  const pathname = usePathname(),
    params = useSearchParams();
  const [expanded, setExpanded] = useState<{
    key: string;
    open: boolean;
  } | null>(null);
  const locationKey = `${pathname}?${params.toString()}`;
  const source = pathname === '/hr' || pathname === '/human-resources';
  const destination = hrConnectionModule(pathname);
  if (hidden || (!source && !destination)) return null;
  const open =
    expanded?.key === locationKey
      ? expanded.open
      : params.get('hrConnections') === '1';
  return (
    <section
      className="mt-6 rounded-2xl border border-border bg-surface p-4"
      aria-label="ارتباطات منابع انسانی"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">
            {source
              ? 'ارتباط منابع انسانی با بخش‌های سامانه'
              : 'درخواست‌های منابع انسانی'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            ارجاع پرونده، پیگیری مهلت و دریافت پاسخ مسئول بخش
          </p>
        </div>
        <Button
          variant="outline"
          aria-expanded={open}
          onClick={() => setExpanded({ key: locationKey, open: !open })}
        >
          {open ? 'بستن فهرست' : 'مشاهده ارتباطات'}
        </Button>
      </div>
      {open ? (
        <Workspace
          key={locationKey}
          target={
            source ||
            destination?.mode === 'REPORT' ||
            destination?.key === 'tasks'
              ? undefined
              : destination?.mode === 'VIA_RESERVATIONS'
                ? 'reservations'
                : destination?.key
          }
          sourceMode={source}
          sourceRecord={source ? params.get('sourceRecord') : null}
        />
      ) : null}
    </section>
  );
}
