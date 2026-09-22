'use client';

import { CalendarDays } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useSystemPreferences } from '@/components/system-preferences-provider';
import {
  formatHeaderDate,
  headerDateKey,
  subscribeHeaderDate,
} from '@/lib/header-today';

const serverDay = () => null;

export function HeaderToday() {
  const preferences = useSystemPreferences();
  const day = useSyncExternalStore(
    subscribeHeaderDate,
    headerDateKey,
    serverDay,
  );
  const label = day
    ? `${preferences.language === 'en' ? 'Today, ' : 'امروز، '}${formatHeaderDate(day, preferences)}`
    : preferences.language === 'en'
      ? "Today's date"
      : 'تاریخ امروز';
  return (
    <time
      aria-label={label}
      className="flex min-h-5 min-w-0 max-w-full items-center gap-1.5 text-xs font-medium text-current"
      data-header-today
      dateTime={day ?? undefined}
      dir={preferences.direction}
      title={`${preferences.language === 'en' ? 'Current date' : 'تاریخ امروز'} — ${preferences.timezone}`}
    >
      <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </time>
  );
}
