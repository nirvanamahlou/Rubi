'use client';

import { CalendarDays } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useSystemPreferences } from '@/components/system-preferences-provider';
import {
  formatHeaderDate,
  formatHeaderTime,
  headerDateKey,
  headerMinuteKey,
  subscribeHeaderDate,
} from '@/lib/header-today';

const serverMinute = () => null;

export function HeaderToday() {
  const preferences = useSystemPreferences();
  const minute = useSyncExternalStore(
    subscribeHeaderDate,
    headerMinuteKey,
    serverMinute,
  );
  const instant = minute ? new Date(`${minute}:00.000Z`) : null;
  const day = instant ? headerDateKey(instant, preferences.timezone) : null;
  const dateLabel = day
    ? `${preferences.language === 'en' ? 'Today, ' : 'امروز، '}${formatHeaderDate(day, preferences)}`
    : preferences.language === 'en'
      ? "Today's date"
      : 'تاریخ امروز';
  const timeLabel = instant ? formatHeaderTime(instant, preferences) : '--:--';
  const label = `${dateLabel} · ${timeLabel}`;
  return (
    <time
      aria-label={label}
      className="flex min-h-5 min-w-0 max-w-full items-center gap-1.5 text-right text-xs font-medium text-current"
      data-header-today
      dateTime={instant?.toISOString()}
      dir={preferences.direction}
      title={`${preferences.language === 'en' ? 'Current date and time' : 'تاریخ و ساعت فعلی'} — ${preferences.timezone}`}
    >
      <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate" dir={preferences.direction}>
        {dateLabel} <span aria-hidden="true">·</span>{' '}
        <bdi dir="ltr">{timeLabel}</bdi>
      </span>
    </time>
  );
}
