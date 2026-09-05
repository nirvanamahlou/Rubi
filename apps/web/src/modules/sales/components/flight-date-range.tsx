'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  calendarMonthDays,
  calendarMonthLabel,
  moveCalendarMonth,
  parseIsoDate,
  type CalendarSystem,
} from '@/components/ui/date-picker.utils';

export interface FlightDateRange {
  from: string;
  to: string;
}
export function selectFlightRange(
  current: FlightDateRange,
  date: string,
): FlightDateRange {
  if (!current.from || current.to) return { from: date, to: '' };
  return date < current.from
    ? { from: date, to: current.from }
    : { from: current.from, to: date };
}
export function FlightDateRangeFilter({
  value,
  onChange,
}: {
  value: FlightDateRange;
  onChange: (range: FlightDateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [anchor, setAnchor] = useState(
    () => parseIsoDate(value.from) ?? new Date(),
  );
  const [system, setSystem] = useState<CalendarSystem>('persian');
  const root = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const format = (date: string) =>
    date
      ? new Intl.DateTimeFormat(system === 'persian' ? 'fa-IR' : 'en-GB', {
          dateStyle: 'medium',
          calendar: system === 'persian' ? 'persian' : 'gregory',
        }).format(parseIsoDate(date)!)
      : '—';
  return (
    <div ref={root} className="relative flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        onClick={() => {
          setDraft(value);
          setOpen((current) => !current);
        }}
      >
        بازه تاریخ اختیاری
        {value.from
          ? ': ' + format(value.from) + ' تا ' + format(value.to)
          : ''}
      </Button>
      {value.from ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            onChange({ from: '', to: '' });
            setOpen(false);
          }}
        >
          پاک کردن فیلتر تاریخ
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">
          همه بلیت‌های آینده، از نزدیک‌ترین تاریخ
        </span>
      )}
      {open ? (
        <div
          role="dialog"
          aria-label="فیلتر بازه تاریخ پرواز"
          className="absolute start-0 top-full z-50 mt-2 w-[min(340px,85vw)] rounded-2xl border border-border bg-surface p-4 shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="ماه قبل"
              onClick={() =>
                setAnchor((current) => moveCalendarMonth(current, -1, system))
              }
            >
              →
            </Button>
            <strong className="text-sm">
              {calendarMonthLabel(anchor, system)}
            </strong>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="ماه بعد"
              onClick={() =>
                setAnchor((current) => moveCalendarMonth(current, 1, system))
              }
            >
              ←
            </Button>
          </div>
          <div className="mb-3 flex gap-2">
            {(['persian', 'gregorian'] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={system === item ? 'primary' : 'outline'}
                onClick={() => setSystem(item)}
              >
                {item === 'persian' ? 'شمسی' : 'میلادی'}
              </Button>
            ))}
          </div>
          <p className="mb-3 text-xs" aria-live="polite">
            {draft.from && !draft.to
              ? 'اکنون روز پایان بازه را انتخاب کنید'
              : 'روز شروع و پایان بازه را در همین تقویم انتخاب کنید'}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {(system === 'persian'
              ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
              : ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']
            ).map((day, index) => (
              <span
                key={index}
                className="text-center text-xs text-muted-foreground"
              >
                {day}
              </span>
            ))}
            {calendarMonthDays(anchor, system).map((day) => {
              const selected = Boolean(
                draft.from &&
                day.isoDate >= draft.from &&
                day.isoDate <= (draft.to || draft.from),
              );
              return (
                <button
                  key={day.isoDate}
                  type="button"
                  aria-label={format(day.isoDate)}
                  aria-pressed={selected}
                  disabled={day.isoDate < today}
                  className={
                    'h-9 rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-30 disabled:cursor-not-allowed ' +
                    (selected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-primary/10') +
                    ' ' +
                    (day.isCurrentMonth ? '' : 'opacity-40')
                  }
                  onClick={() =>
                    setDraft((current) =>
                      selectFlightRange(current, day.isoDate),
                    )
                  }
                >
                  {new Intl.NumberFormat(
                    system === 'persian' ? 'fa-IR' : 'en-US',
                  ).format(day.day)}
                </button>
              );
            })}
          </div>
          <p className="my-3 text-xs">
            {format(draft.from)} — {format(draft.to)}
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={!draft.from || !draft.to || draft.to < today}
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
          >
            اعمال فیلتر
          </Button>
        </div>
      ) : null}
    </div>
  );
}
