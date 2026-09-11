'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Alert, Badge, Button, Card, EmptyState, Input } from '@/components/ui';
import {
  calendarMonthLabel,
  calendarParts,
  formatCalendarValue,
  moveCalendarMonth,
  toIsoDate,
} from '@/components/ui/date-picker.utils';
import { cn } from '@/lib/utils';
import { safeWorkbenchHref } from './model';
import {
  calendarDays,
  calendarToday,
  entriesInView,
  filterCalendar,
  shiftDays,
  tehranDay,
  type CalendarEntry,
  type CalendarFilter,
  type CalendarView,
} from './calendar-model';

const views = [
  ['month', 'ماه'],
  ['week', 'هفته'],
  ['agenda', 'برنامه'],
  ['undated', 'بدون تاریخ'],
] as const;
const statuses = [
  ['open', 'باز'],
  ['all', 'همه'],
  ['planned', 'برنامه‌ریزی‌شده'],
  ['active', 'فعال'],
  ['completed', 'تکمیل‌شده'],
  ['cancelled', 'لغوشده'],
] as const;
const weekdays = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];
const emptyEntries: readonly CalendarEntry[] = [];

export function WorkbenchCalendar({
  entries = emptyEntries,
  sourceReady = false,
}: {
  entries?: readonly CalendarEntry[];
  sourceReady?: boolean;
}) {
  const [today, setToday] = useState(calendarToday);
  const [anchor, setAnchor] = useState(calendarToday);
  const [selected, setSelected] = useState(() => toIsoDate(calendarToday()));
  const [view, setView] = useState<CalendarView>('month');
  const [filter, setFilter] = useState<CalendarFilter>({
    query: '',
    status: 'open',
    priority: 'all',
  });
  const filtered = filterCalendar(entries, filter);
  const visible = entriesInView(filtered, anchor, view);
  const days = calendarDays(anchor, view);
  const selectedEntries = filtered.filter(
    (entry) => entry.dueAt && tehranDay(entry.dueAt) === selected,
  );
  const selectedMonth = calendarParts(anchor, 'persian');
  const dateLabel = (value: string) => formatCalendarValue(value, 'persian');
  function move(direction: -1 | 1) {
    setAnchor((current) =>
      view === 'week'
        ? shiftDays(current, direction * 7)
        : moveCalendarMonth(current, direction, 'persian'),
    );
  }
  function goToday() {
    const next = calendarToday();
    setToday(next);
    setAnchor(next);
    setSelected(toIsoDate(next));
  }
  function renderEntries(items: readonly CalendarEntry[]) {
    return items.length ? (
      <ul className="divide-y divide-border">
        {items.map((entry) => {
          const href = safeWorkbenchHref(entry.href ?? null);
          return (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <span className="min-w-0 flex-1 font-semibold">
                {href ? (
                  <Link href={href} className="text-primary hover:underline">
                    {entry.title}
                  </Link>
                ) : (
                  entry.title
                )}
              </span>
              <Badge>{statuses.find(([id]) => id === entry.status)?.[1]}</Badge>
              {entry.dueAt && tehranDay(entry.dueAt) ? (
                <time
                  dateTime={entry.dueAt}
                  className="text-sm text-muted-foreground"
                >
                  {dateLabel(tehranDay(entry.dueAt)!)}
                </time>
              ) : null}
            </li>
          );
        })}
      </ul>
    ) : (
      <EmptyState
        title={
          sourceReady
            ? 'برنامه‌ای برای نمایش وجود ندارد'
            : 'هنوز برنامه‌ای به تقویم متصل نشده است'
        }
        description={
          sourceReady
            ? 'بازه یا فیلترها را تغییر دهید.'
            : 'پس از اتصال موعد کارها و درخواست‌های شما، موارد در این بخش نمایش داده می‌شوند.'
        }
      />
    );
  }
  return (
    <section className="space-y-4" dir="rtl" aria-label="تقویم میزکار من">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <CalendarDays aria-hidden="true" className="size-5 text-primary" />
          تقویم من
        </h2>
        <Badge>محدوده: من</Badge>
      </div>
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              aria-hidden="true"
              className="absolute end-3 top-3 size-4 text-muted-foreground"
            />
            <Input
              aria-label="جست‌وجوی برنامه‌ها"
              placeholder="جست‌وجوی کار یا درخواست…"
              className="pe-10"
              value={filter.query}
              onChange={(event) =>
                setFilter({ ...filter, query: event.target.value })
              }
            />
          </div>
          <div
            role="group"
            aria-label="وضعیت برنامه‌ها"
            className="flex flex-wrap gap-2"
          >
            {statuses.map(([status, label]) => (
              <Button
                key={status}
                size="sm"
                variant={filter.status === status ? 'primary' : 'outline'}
                aria-pressed={filter.status === status}
                onClick={() => setFilter({ ...filter, status })}
                className="rounded-full"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          اولویت
          <select
            aria-label="اولویت برنامه‌ها"
            className="min-h-10 min-w-48 rounded-xl border border-border bg-surface px-3 text-foreground"
            value={filter.priority}
            onChange={(event) =>
              setFilter({
                ...filter,
                priority: event.target.value as CalendarFilter['priority'],
              })
            }
          >
            <option value="all">همه اولویت‌ها</option>
            <option value="normal">عادی</option>
            <option value="high">مهم</option>
            <option value="urgent">فوری</option>
          </select>
        </label>
      </Card>
      {!sourceReady ? (
        <Alert
          title="اتصال موعدها هنوز فعال نیست"
          description="سرویس موعد کارها و درخواست‌های میزکار هنوز ارائه نشده است؛ تاریخ ایجاد اعلان‌ها به‌جای موعد اقدام نمایش داده نمی‌شود."
        />
      ) : null}
      <Card className="overflow-hidden">
        <div className="space-y-4 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            تقویم بر اساس موعد اقدام و به وقت تهران است؛ مهلت پاسخ و حل درخواست
            جداست.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="min-w-40 font-black" aria-live="polite">
              {view === 'undated'
                ? 'برنامه‌های بدون تاریخ'
                : view === 'week'
                  ? `${dateLabel(toIsoDate(days[0]!))} تا ${dateLabel(toIsoDate(days[6]!))}`
                  : calendarMonthLabel(anchor, 'persian')}
            </h3>
            <div
              role="group"
              aria-label="نمای تقویم"
              className="flex flex-wrap gap-1 rounded-full bg-muted p-1"
            >
              {views.map(([value, label]) => (
                <Button
                  key={value}
                  variant={view === value ? 'primary' : 'ghost'}
                  size="sm"
                  className="rounded-full"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {view !== 'undated' ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={view === 'week' ? 'هفته قبل' : 'ماه قبل'}
                  onClick={() => move(-1)}
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Button>
                <Button variant="outline" onClick={goToday}>
                  امروز
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={view === 'week' ? 'هفته بعد' : 'ماه بعد'}
                  onClick={() => move(1)}
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {visible.length.toLocaleString('fa-IR')} مورد در بازهٔ نمایش
          </p>
        </div>
        {view === 'month' || view === 'week' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[560px] px-4 pb-4">
              <div className="grid grid-cols-7">
                {weekdays.map((day) => (
                  <div
                    key={day}
                    className="py-3 text-center text-xs font-semibold text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-border">
                {days.map((date) => {
                  const iso = toIsoDate(date);
                  const parts = calendarParts(date, 'persian');
                  const isToday = iso === toIsoDate(today);
                  const items = visible.filter(
                    (entry) => entry.dueAt && tehranDay(entry.dueAt) === iso,
                  );
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-label={`${dateLabel(iso)}${isToday ? '، امروز' : ''}، ${items.length.toLocaleString('fa-IR')} برنامه`}
                      aria-pressed={selected === iso}
                      onClick={() => setSelected(iso)}
                      className={cn(
                        'flex min-h-28 min-w-0 flex-col items-start justify-start border-b border-e border-border p-2 text-start transition hover:bg-primary/5 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-32',
                        parts.month !== selectedMonth.month && view === 'month'
                          ? 'bg-muted/50 text-muted-foreground'
                          : 'bg-surface',
                        isToday && 'border-t-2 border-t-primary',
                        selected === iso &&
                          'bg-primary/10 ring-2 ring-inset ring-primary',
                      )}
                    >
                      <span
                        className={cn(
                          'mb-3 inline-block rounded-full px-2 py-1 text-sm font-bold',
                          isToday && 'bg-primary text-primary-foreground',
                        )}
                      >
                        {parts.day.toLocaleString('fa-IR')}
                        {isToday ? ' امروز' : ''}
                      </span>
                      {items.slice(0, 2).map((item) => (
                        <span
                          key={item.id}
                          className="mb-1 block truncate rounded bg-primary/10 px-1 py-1 text-xs text-primary"
                        >
                          {item.title}
                        </span>
                      ))}
                      {items.length > 2 ? (
                        <span className="text-xs">
                          {(items.length - 2).toLocaleString('fa-IR')} مورد دیگر
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5">{renderEntries(visible)}</div>
        )}
      </Card>
      {view === 'month' || view === 'week' ? (
        <Card className="p-5">
          <h3 className="mb-3 font-bold">برنامه‌های {dateLabel(selected)}</h3>
          {renderEntries(selectedEntries)}
        </Card>
      ) : null}
    </section>
  );
}
