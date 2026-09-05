'use client';
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  calendarMonthDays,
  calendarMonthLabel,
  calendarMonthName,
  calendarParts,
  setCalendarMonthYear,
  moveCalendarMonth,
  parseIsoDate,
  type CalendarSystem,
} from '@/components/ui/date-picker.utils';

export interface FlightDateRange {
  from: string;
  to: string;
}
export function flightCalendarPlacement(
  top: number,
  bottom: number,
  viewport: number,
) {
  const below = Math.max(0, viewport - bottom - 16);
  const above = Math.max(0, top - 88);
  return {
    above: below < 460 && above > below,
    maxHeight: Math.max(
      120,
      Math.min(520, below < 460 && above > below ? above : below),
    ),
  };
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
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const [yearStart, setYearStart] = useState(0);
  const [placement, setPlacement] = useState({ above: false, maxHeight: 520 });
  const trigger = useRef<HTMLButtonElement>(null);
  const parts = calendarParts(anchor, system);
  const number = (value: number) =>
    new Intl.NumberFormat(system === 'persian' ? 'fa-IR' : 'en-US', {
      useGrouping: false,
    }).format(value);
  const navigate = (offset: -1 | 1) => {
    if (view === 'years') setYearStart((value) => value + offset * 12);
    else if (view === 'months')
      setAnchor(
        setCalendarMonthYear(anchor, parts.year + offset, parts.month, system),
      );
    else setAnchor(moveCalendarMonth(anchor, offset, system));
  };
  const root = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (rect)
        setPlacement(
          flightCalendarPlacement(rect.top, rect.bottom, window.innerHeight),
        );
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
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
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
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
    <div ref={root} className="relative grid w-full gap-2">
      <button
        ref={trigger}
        type="button"
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-input bg-surface px-3 text-sm text-foreground shadow-xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft(value);
          setView('days');
          setAnchor(parseIsoDate(value.from) ?? new Date());
          const rect = trigger.current?.getBoundingClientRect();
          if (rect)
            setPlacement(
              flightCalendarPlacement(
                rect.top,
                rect.bottom,
                window.innerHeight,
              ),
            );
          setOpen((current) => !current);
        }}
      >
        <span>
          بازه تاریخ اختیاری
          {value.from
            ? ': ' + format(value.from) + ' تا ' + format(value.to)
            : ''}
        </span>
        <CalendarDays
          aria-hidden="true"
          className="size-5 shrink-0 text-primary"
        />
      </button>
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
          dir="rtl"
          aria-label="فیلتر بازه تاریخ پرواز"
          style={{ maxHeight: placement.maxHeight }}
          className={`absolute start-0 z-[70] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-primary/25 bg-popover p-3 text-popover-foreground shadow-2xl shadow-primary/15 ${placement.above ? 'bottom-[calc(100%+0.5rem)]' : 'top-[3.25rem]'}`}
        >
          <div
            className="mb-3 grid grid-cols-2 rounded-xl bg-secondary p-1"
            role="group"
            aria-label="نوع تقویم"
          >
            {(['persian', 'gregorian'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`min-h-9 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${system === item ? 'bg-primary text-primary-foreground shadow-sm' : 'text-secondary-foreground hover:bg-primary/10'}`}
                aria-pressed={system === item}
                onClick={() => {
                  setSystem(item);
                  setView('days');
                }}
              >
                {item === 'persian' ? 'شمسی' : 'میلادی'}
              </button>
            ))}
          </div>
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-primary px-2 py-2 text-primary-foreground">
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              aria-label={
                view === 'days'
                  ? 'ماه قبل'
                  : view === 'months'
                    ? 'سال قبل'
                    : '۱۲ سال قبل'
              }
              onClick={() => navigate(-1)}
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="flex flex-1 justify-center gap-1">
              {view === 'years' ? (
                <span dir="ltr" className="text-sm font-bold">
                  {number(yearStart)} – {number(yearStart + 11)}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    className="h-9 rounded-lg px-2 text-sm font-bold hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
                    aria-label="نمایش شبکه ماه‌ها"
                    onClick={() => setView('months')}
                  >
                    {calendarMonthName(anchor, system)}
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-lg px-2 text-sm font-bold hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
                    aria-label="نمایش شبکه سال‌ها"
                    onClick={() => {
                      setYearStart(parts.year - 5);
                      setView('years');
                    }}
                  >
                    {number(parts.year)}
                  </button>
                </>
              )}
              <span className="sr-only">
                {calendarMonthLabel(anchor, system)}
              </span>
            </div>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              aria-label={
                view === 'days'
                  ? 'ماه بعد'
                  : view === 'months'
                    ? 'سال بعد'
                    : '۱۲ سال بعد'
              }
              onClick={() => navigate(1)}
            >
              <ChevronLeft className="size-5" />
            </button>
          </div>
          <p className="mb-3 text-xs" aria-live="polite">
            {draft.from && !draft.to
              ? 'اکنون روز پایان بازه را انتخاب کنید'
              : 'روز شروع و پایان بازه را در همین تقویم انتخاب کنید'}
          </p>
          {view !== 'days' ? (
            <div
              className="grid grid-cols-3 gap-2 rounded-xl bg-primary/5 p-2"
              role="group"
              aria-label={
                view === 'months' ? 'شبکه انتخاب ماه' : 'شبکه انتخاب سال'
              }
            >
              {Array.from({ length: 12 }, (_, index) => {
                const value = view === 'months' ? index + 1 : yearStart + index;
                const selected =
                  value === (view === 'months' ? parts.month : parts.year);
                const label =
                  view === 'months'
                    ? calendarMonthName(
                        setCalendarMonthYear(anchor, parts.year, value, system),
                        system,
                      )
                    : number(value);
                return (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={selected}
                    className={`min-h-12 rounded-xl border px-2 text-sm font-semibold shadow-xs focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/15 bg-surface hover:bg-primary/10'}`}
                    onClick={() => {
                      setAnchor(
                        setCalendarMonthYear(
                          anchor,
                          view === 'years' ? value : parts.year,
                          view === 'months' ? value : parts.month,
                          system,
                        ),
                      );
                      setView(view === 'years' ? 'months' : 'days');
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {(system === 'persian'
                ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
                : ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش']
              ).map((day, index) => (
                <span
                  key={index}
                  className="py-1 text-center text-xs font-bold text-primary"
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
                      (day.isoDate === draft.from || day.isoDate === draft.to
                        ? 'bg-primary font-bold text-primary-foreground shadow-sm'
                        : selected
                          ? 'bg-primary/15 text-primary'
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
          )}
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
