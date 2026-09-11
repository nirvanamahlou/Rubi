import {
  calendarMonthDays,
  parseIsoDate,
  toIsoDate,
} from '@/components/ui/date-picker.utils';

export type CalendarView = 'month' | 'week' | 'agenda' | 'undated';
export type CalendarStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export interface CalendarEntry {
  id: string;
  title: string;
  dueAt: string | null;
  status: CalendarStatus;
  priority: 'normal' | 'high' | 'urgent';
  href?: string;
  description?: string;
  imageName?: string;
  imageUrl?: string;
  linkUrl?: string;
}
export interface CalendarFilter {
  query: string;
  status: CalendarStatus | 'all' | 'open';
  priority: CalendarEntry['priority'] | 'all';
}

export function normalizeCalendarLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function calendarImageError(
  file: Pick<File, 'size' | 'type'> | null,
): string | null {
  if (!file) return null;
  if (!file.type.startsWith('image/')) return 'فایل انتخاب‌شده باید تصویر باشد.';
  if (file.size > 5 * 1024 * 1024)
    return 'حجم تصویر باید حداکثر ۵ مگابایت باشد.';
  return null;
}

export function tehranDay(value: string | Date): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function calendarToday(): Date {
  return parseIsoDate(tehranDay(new Date())!)!;
}
export function shiftDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}
export function calendarDays(anchor: Date, view: CalendarView): Date[] {
  if (view === 'week') {
    const first = shiftDays(anchor, -((anchor.getDay() + 1) % 7));
    return Array.from({ length: 7 }, (_, index) => shiftDays(first, index));
  }
  return calendarMonthDays(anchor, 'persian')
    .filter((day) => view !== 'agenda' || day.isCurrentMonth)
    .map((day) => day.date);
}
export function filterCalendar(
  entries: readonly CalendarEntry[],
  filter: CalendarFilter,
): CalendarEntry[] {
  const normalize = (value: string) =>
    value
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .trim()
      .toLocaleLowerCase('fa-IR');
  return entries.filter(
    (entry) =>
      (!filter.query.trim() ||
        normalize(`${entry.title} ${entry.description ?? ''}`).includes(
          normalize(filter.query),
        )) &&
      (filter.priority === 'all' || entry.priority === filter.priority) &&
      (filter.status === 'all' ||
        (filter.status === 'open'
          ? entry.status !== 'completed' && entry.status !== 'cancelled'
          : entry.status === filter.status)),
  );
}
export function entriesInView(
  entries: readonly CalendarEntry[],
  anchor: Date,
  view: CalendarView,
): CalendarEntry[] {
  if (view === 'undated')
    return entries.filter((entry) => entry.dueAt === null);
  const days = new Set(calendarDays(anchor, view).map(toIsoDate));
  return entries
    .filter(
      (entry) => entry.dueAt !== null && days.has(tehranDay(entry.dueAt) ?? ''),
    )
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
}
