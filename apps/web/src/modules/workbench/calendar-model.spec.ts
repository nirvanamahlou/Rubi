import { describe, expect, it } from 'vitest';
import {
  calendarMonthLabel,
  moveCalendarMonth,
  toIsoDate,
} from '@/components/ui/date-picker.utils';
import {
  calendarDays,
  entriesInView,
  filterCalendar,
  calendarImageError,
  normalizeCalendarLink,
  tehranDay,
  type CalendarEntry,
} from './calendar-model';
import { normalizeWorkbenchTab } from './model';

const entries: CalendarEntry[] = [
  {
    id: 'a',
    title: 'پیگیری قرارداد',
    dueAt: '2026-09-11T21:00:00Z',
    status: 'active',
    priority: 'urgent',
  },
  {
    id: 'b',
    title: 'بررسی سند',
    dueAt: null,
    status: 'planned',
    priority: 'normal',
  },
  {
    id: 'c',
    title: 'جلسه',
    dueAt: '2026-09-10T08:00:00Z',
    status: 'completed',
    priority: 'high',
  },
  {
    id: 'd',
    title: 'نامعتبر',
    dueAt: 'invalid',
    status: 'cancelled',
    priority: 'normal',
  },
];
describe('Workbench Persian calendar', () => {
  it('restores the calendar tab', () =>
    expect(normalizeWorkbenchTab('calendar')).toBe('calendar'));
  it('uses Tehran midnight and excludes invalid timestamps', () => {
    expect(tehranDay('2026-09-11T21:00:00Z')).toBe('2026-09-12');
    expect(tehranDay('2026-09-11T20:00:00Z')).toBe('2026-09-11');
    expect(tehranDay('invalid')).toBeNull();
  });
  it('starts weeks on Saturday with exactly seven distinct days', () => {
    const days = calendarDays(new Date(2026, 8, 11, 12), 'week');
    expect(days.map(toIsoDate)).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
  });
  it('handles leap Esfand and month navigation across Nowruz', () => {
    const month = calendarDays(new Date(2025, 2, 20, 12), 'agenda');
    expect(month).toHaveLength(30);
    expect(toIsoDate(month.at(-1)!)).toBe('2025-03-20');
    const next = moveCalendarMonth(new Date(2025, 2, 1, 12), 1, 'persian');
    expect(calendarMonthLabel(next, 'persian')).toContain('فروردین');
    expect(calendarDays(next, 'month')).toHaveLength(42);
  });
  it('combines open status, priority and normalized Persian search', () => {
    expect(
      filterCalendar(entries, {
        query: 'پيگيري',
        status: 'open',
        priority: 'urgent',
      }).map((x) => x.id),
    ).toEqual(['a']);
    expect(
      filterCalendar(entries, {
        query: '',
        status: 'open',
        priority: 'all',
      }).map((x) => x.id),
    ).toEqual(['a', 'b']);
  });
  it('separates undated items from malformed dates and respects week boundaries', () => {
    const anchor = new Date(2026, 8, 11, 12);
    expect(entriesInView(entries, anchor, 'undated').map((x) => x.id)).toEqual([
      'b',
    ]);
    expect(entriesInView(entries, anchor, 'week').map((x) => x.id)).toEqual([
      'c',
    ]);
  });
  it('accepts safe event links and supported calendar images', () => {
    expect(normalizeCalendarLink('https://example.com/event')).toBe(
      'https://example.com/event',
    );
    expect(normalizeCalendarLink('javascript:alert(1)')).toBeNull();
    expect(normalizeCalendarLink('')).toBe('');
    expect(calendarImageError({ size: 1024, type: 'image/png' })).toBeNull();
    expect(calendarImageError({ size: 1024, type: 'application/pdf' })).toBe(
      'فایل انتخاب‌شده باید تصویر باشد.',
    );
  });
});
