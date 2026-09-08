'use client';

import { CalendarDays } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import {
  formatHeaderDate,
  headerDateKey,
  subscribeHeaderDate,
} from '@/lib/header-today';

const serverDay = () => null;

export function HeaderToday() {
  const day = useSyncExternalStore(
    subscribeHeaderDate,
    headerDateKey,
    serverDay,
  );
  const label = day ? `امروز، ${formatHeaderDate(day)}` : 'تاریخ امروز';
  return (
    <time
      aria-label={label}
      className="flex min-h-5 min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-current"
      data-header-today
      dateTime={day ?? undefined}
      dir="rtl"
      title="تاریخ امروز به وقت تهران"
    >
      <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </time>
  );
}
