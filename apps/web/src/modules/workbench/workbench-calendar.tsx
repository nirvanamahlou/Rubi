'use client';
import { WorkbenchSelect } from './workbench-select';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  Search,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
} from '@/components/ui';
import {
  calendarMonthLabel,
  calendarParts,
  formatCalendarValue,
  moveCalendarMonth,
  parseIsoDate,
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
import {
  CalendarEventDialog,
  type CalendarEventDraft,
} from './calendar-event-dialog';
import { workbenchPersonalApi } from './workbench-personal-api';
import { uploadWorkbenchAttachments } from './workbench-attachments';

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
  branchId,
}: {
  entries?: readonly CalendarEntry[];
  sourceReady?: boolean;
  branchId?: string;
}) {
  const [today, setToday] = useState(calendarToday);
  const [anchor, setAnchor] = useState(calendarToday);
  const [selected, setSelected] = useState(() => toIsoDate(calendarToday()));
  const [view, setView] = useState<CalendarView>('month');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [localEntries, setLocalEntries] = useState<CalendarEntry[]>([]);
  const [connectedEntries, setConnectedEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<CalendarFilter>({
    query: '',
    status: 'open',
    priority: 'all',
  });
  const allEntries = [...entries, ...connectedEntries, ...localEntries];
  const filtered = filterCalendar(allEntries, filter);
  const visible = entriesInView(filtered, anchor, view);
  const days = calendarDays(anchor, view);
  const selectedEntries = filtered.filter(
    (entry) => entry.dueAt && tehranDay(entry.dueAt) === selected,
  );
  const selectedMonth = calendarParts(anchor, 'persian');
  const hasCalendarSource = sourceReady || !loading;
  const dateLabel = (value: string) => formatCalendarValue(value, 'persian');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const personal = await workbenchPersonalApi.calendar();
      setLocalEntries(
        personal.data.map((row) => ({
          id: row.id,
          title: row.title,
          dueAt: row.dueAt,
          status: row.status.toLowerCase() as CalendarEntry['status'],
          priority: row.priority.toLowerCase() as CalendarEntry['priority'],
          ...(row.description ? { description: row.description } : {}),
          ...(row.linkUrl ? { linkUrl: row.linkUrl } : {}),
          ...(row.imageDocumentId
            ? {
                imageName: 'تصویر رویداد',
                imageDocumentId: row.imageDocumentId,
              }
            : {}),
        })),
      );
      setConnectedEntries(
        personal.sources.customerAffairs.map((row) => ({
          id: `referral-${row.id}`,
          title: `${row.trackingNumber} — ${row.title}`,
          description: row.ticketSubject,
          dueAt: row.dueAt,
          status:
            row.status === 'DONE'
              ? 'completed'
              : row.status === 'IN_PROGRESS'
                ? 'active'
                : 'planned',
          priority: 'high',
          href: `/workbench?tab=requests&ticket=${encodeURIComponent(row.ticketId)}`,
        })),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'دریافت تقویم انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function createEvent(draft: CalendarEventDraft) {
    if (!branchId)
      throw new Error('برای ثبت رویداد باید یک شعبه مجاز داشته باشید.');
    const id = crypto.randomUUID();
    const imageDocumentIds = await uploadWorkbenchAttachments({
      entityType: 'WorkbenchCalendarEvent',
      entityId: id,
      title: `تصویر رویداد: ${draft.title}`,
      description: 'تصویر ثبت‌شده از تقویم میزکار',
      branchId,
      files: draft.image ? [draft.image] : [],
    });
    const response = await workbenchPersonalApi.createEvent({
      id,
      branchId,
      title: draft.title,
      description: draft.description,
      dueAt: `${draft.date}T12:00:00+03:30`,
      linkUrl: draft.linkUrl || null,
      imageDocumentId: imageDocumentIds[0] ?? null,
    });
    const row = response.data;
    const entry: CalendarEntry = {
      id: row.id,
      title: row.title,
      dueAt: row.dueAt,
      status: 'planned',
      priority: 'normal',
      ...(row.description ? { description: row.description } : {}),
      ...(row.imageDocumentId
        ? {
            imageName: draft.image?.name ?? 'تصویر رویداد',
            imageDocumentId: row.imageDocumentId,
          }
        : {}),
      ...(row.linkUrl ? { linkUrl: row.linkUrl } : {}),
    };
    setLocalEntries((current) => [...current, entry]);
    const nextDate = parseIsoDate(draft.date);
    if (nextDate) setAnchor(nextDate);
    setSelected(draft.date);
    setView('month');
    setFilter((current) => ({ ...current, status: 'open' }));
  }
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
              className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 font-semibold">
                    {href ? (
                      <Link
                        href={href}
                        className="text-primary hover:underline"
                      >
                        {entry.title}
                      </Link>
                    ) : (
                      entry.title
                    )}
                  </span>
                  <Badge>
                    {statuses.find(([id]) => id === entry.status)?.[1]}
                  </Badge>
                </div>
                {entry.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                    {entry.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {entry.linkUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={entry.linkUrl} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden="true" className="size-4" />
                        بازکردن لینک
                      </a>
                    </Button>
                  ) : null}
                  {entry.imageName ? (
                    <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                      <ImageIcon aria-hidden="true" className="size-4" />
                      {entry.imageName}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-start gap-3 sm:flex-col sm:items-end">
                {entry.dueAt && tehranDay(entry.dueAt) ? (
                  <time
                    dateTime={entry.dueAt}
                    className="text-sm text-muted-foreground"
                  >
                    {dateLabel(tehranDay(entry.dueAt)!)}
                  </time>
                ) : null}
                {entry.imageDocumentId ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/documents?document=${encodeURIComponent(entry.imageDocumentId)}`}
                    >
                      مشاهده تصویر
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    ) : (
      <EmptyState
        title={
          hasCalendarSource
            ? 'برنامه‌ای برای نمایش وجود ندارد'
            : 'هنوز برنامه‌ای به تقویم متصل نشده است'
        }
        description={
          hasCalendarSource
            ? 'بازه یا فیلترها را تغییر دهید.'
            : 'با دکمه افزودن رویداد، اولین برنامه خود را در این تقویم ثبت کنید.'
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge>محدوده: من</Badge>
          <Button onClick={() => setEventDialogOpen(true)}>
            <CalendarPlus aria-hidden="true" className="size-4" />
            افزودن رویداد
          </Button>
        </div>
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
          <WorkbenchSelect
            label="اولویت برنامه‌ها"
            value={filter.priority}
            onValueChange={(priority) =>
              setFilter({
                ...filter,
                priority: priority as CalendarFilter['priority'],
              })
            }
            options={[
              { value: 'all', label: 'همه اولویت‌ها' },
              { value: 'normal', label: 'عادی' },
              { value: 'high', label: 'مهم' },
              { value: 'urgent', label: 'فوری' },
            ]}
          />
        </label>
      </Card>
      {error ? (
        <Alert tone="error" title="تقویم دریافت نشد" description={error} />
      ) : null}
      {loading ? <Skeleton className="h-40" /> : null}
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
      <CalendarEventDialog
        key={`${selected}-${eventDialogOpen ? 'open' : 'closed'}`}
        open={eventDialogOpen}
        initialDate={selected}
        onOpenChange={setEventDialogOpen}
        onCreate={createEvent}
      />
    </section>
  );
}
