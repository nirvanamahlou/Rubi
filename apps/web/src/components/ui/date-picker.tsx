'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  calendarMonthDays,
  calendarMonthLabel,
  calendarMonthName,
  calendarParts,
  formatCalendarValue,
  joinDateAndTime,
  moveCalendarMonth,
  parseIsoDate,
  setCalendarMonthYear,
  toIsoDate,
  type CalendarSystem,
} from './date-picker.utils';

const weekdayLabels = {
  persian: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
  gregorian: ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'],
} satisfies Record<CalendarSystem, string[]>;

type CalendarView = 'days' | 'months' | 'years';

function formatCalendarNumber(value: number, system: CalendarSystem): string {
  return new Intl.NumberFormat(system === 'gregorian' ? 'en-US' : 'fa-IR', {
    useGrouping: false,
  }).format(value);
}

export interface DatePickerProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  includeTime?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean;
}

export function DatePicker({
  className,
  defaultValue = '',
  disabled,
  id,
  includeTime = false,
  name,
  onChange,
  placeholder = 'انتخاب تاریخ',
  readOnly,
  required,
  value,
  ...ariaProps
}: DatePickerProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;
  const [calendarSystem, setCalendarSystem] =
    React.useState<CalendarSystem>('persian');
  const [calendarView, setCalendarView] =
    React.useState<CalendarView>('days');
  const [yearGridStart, setYearGridStart] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(
    () => parseIsoDate(currentValue) ?? new Date(),
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedDate = currentValue.slice(0, 10);
  const days = calendarMonthDays(anchor, calendarSystem);
  const anchorParts = calendarParts(anchor, calendarSystem);
  const yearOptions = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => yearGridStart + index),
    [yearGridStart],
  );
  const monthOptions = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const date = setCalendarMonthYear(
          anchor,
          anchorParts.year,
          month,
          calendarSystem,
        );
        return { month, label: calendarMonthName(date, calendarSystem) };
      }),
    [anchor, anchorParts.year, calendarSystem],
  );

  React.useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const emit = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  const selectDay = (isoDate: string) => {
    emit(joinDateAndTime(isoDate, currentValue, includeTime));
    if (!includeTime) setOpen(false);
  };

  const changeCalendarSystem = (system: CalendarSystem) => {
    setCalendarSystem(system);
    setCalendarView('days');
  };

  const navigateBackward = () => {
    if (calendarView === 'years') {
      setYearGridStart((current) => current - 12);
      return;
    }
    if (calendarView === 'months') {
      setAnchor((current) =>
        setCalendarMonthYear(
          current,
          anchorParts.year - 1,
          anchorParts.month,
          calendarSystem,
        ),
      );
      return;
    }
    setAnchor((current) => moveCalendarMonth(current, -1, calendarSystem));
  };

  const navigateForward = () => {
    if (calendarView === 'years') {
      setYearGridStart((current) => current + 12);
      return;
    }
    if (calendarView === 'months') {
      setAnchor((current) =>
        setCalendarMonthYear(
          current,
          anchorParts.year + 1,
          anchorParts.month,
          calendarSystem,
        ),
      );
      return;
    }
    setAnchor((current) => moveCalendarMonth(current, 1, calendarSystem));
  };

  const previousLabel =
    calendarView === 'days'
      ? 'ماه قبل'
      : calendarView === 'months'
        ? 'سال قبل'
        : '۱۲ سال قبل';
  const nextLabel =
    calendarView === 'days'
      ? 'ماه بعد'
      : calendarView === 'months'
        ? 'سال بعد'
        : '۱۲ سال بعد';

  return (
    <div className={cn('relative w-full', className)} ref={rootRef}>
      <input name={name} type="hidden" value={currentValue} />
      <button
        {...ariaProps}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-input bg-surface px-3 text-sm text-foreground shadow-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
          !currentValue && 'text-muted-foreground',
        )}
        disabled={disabled || readOnly}
        id={id}
        onClick={() => {
          if (!open) {
            const parsed = parseIsoDate(currentValue);
            if (parsed) setAnchor(parsed);
            setCalendarView('days');
          }
          setOpen((current) => !current);
        }}
        type="button"
      >
        <span>
          {currentValue
            ? formatCalendarValue(currentValue, calendarSystem, includeTime)
            : placeholder}
        </span>
        <CalendarDays aria-hidden="true" className="size-5 text-primary" />
      </button>

      {open ? (
        <div
          aria-label="انتخاب تاریخ"
          className="absolute start-0 top-[calc(100%+0.5rem)] z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-primary/25 bg-popover p-3 text-popover-foreground shadow-2xl shadow-primary/15"
          dir="rtl"
          role="dialog"
        >
          <div
            aria-label="نوع تقویم"
            className="mb-3 grid grid-cols-2 rounded-xl bg-secondary p-1"
            role="group"
          >
            {(['persian', 'gregorian'] as const).map((system) => (
              <button
                aria-pressed={calendarSystem === system}
                className={cn(
                  'min-h-9 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                  calendarSystem === system
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-secondary-foreground hover:bg-primary/10',
                )}
                key={system}
                onClick={() => changeCalendarSystem(system)}
                type="button"
              >
                {system === 'persian' ? 'شمسی' : 'میلادی'}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-primary px-2 py-2 text-primary-foreground">
            <button
              aria-label={previousLabel}
              className="flex size-9 items-center justify-center rounded-lg outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              onClick={navigateBackward}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
              {calendarView === 'years' ? (
                <span className="px-2 text-sm font-bold" dir="ltr">
                  {formatCalendarNumber(yearGridStart, calendarSystem)} –{' '}
                  {formatCalendarNumber(yearGridStart + 11, calendarSystem)}
                </span>
              ) : (
                <>
                  <button
                    aria-label="نمایش شبکه ماه‌ها"
                    aria-pressed={calendarView === 'months'}
                    className={cn(
                      'h-9 min-w-0 flex-1 rounded-lg px-2 text-sm font-bold outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white',
                      calendarView === 'months' && 'bg-white/20 shadow-sm',
                    )}
                    onClick={() => setCalendarView('months')}
                    type="button"
                  >
                    {calendarMonthName(anchor, calendarSystem)}
                  </button>
                  <button
                    aria-label="نمایش شبکه سال‌ها"
                    className="h-9 min-w-0 flex-1 rounded-lg px-2 text-sm font-bold outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
                    dir="ltr"
                    onClick={() => {
                      setYearGridStart(anchorParts.year - 5);
                      setCalendarView('years');
                    }}
                    type="button"
                  >
                    {formatCalendarNumber(anchorParts.year, calendarSystem)}
                  </button>
                </>
              )}
              <span className="sr-only">
                {calendarMonthLabel(anchor, calendarSystem)}
              </span>
            </div>
            <button
              aria-label={nextLabel}
              className="flex size-9 items-center justify-center rounded-lg outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              onClick={navigateForward}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
          </div>

          {calendarView === 'months' ? (
            <div
              aria-label="شبکه انتخاب ماه"
              className="grid grid-cols-3 gap-2 rounded-xl bg-primary/5 p-2"
              role="group"
            >
              {monthOptions.map((option) => (
                <button
                  aria-label={`ماه ${option.label}`}
                  aria-pressed={option.month === anchorParts.month}
                  className={cn(
                    'min-h-12 rounded-xl border border-primary/15 bg-surface px-2 text-sm font-semibold text-foreground shadow-xs outline-none transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                    option.month === anchorParts.month &&
                      'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90',
                  )}
                  key={option.month}
                  onClick={() => {
                    setAnchor((current) =>
                      setCalendarMonthYear(
                        current,
                        anchorParts.year,
                        option.month,
                        calendarSystem,
                      ),
                    );
                    setCalendarView('days');
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : calendarView === 'years' ? (
            <div
              aria-label="شبکه انتخاب سال"
              className="grid grid-cols-3 gap-2 rounded-xl bg-primary/5 p-2"
              role="group"
            >
              {yearOptions.map((year) => (
                <button
                  aria-label={`سال ${formatCalendarNumber(year, calendarSystem)}`}
                  aria-pressed={year === anchorParts.year}
                  className={cn(
                    'min-h-12 rounded-xl border border-primary/15 bg-surface px-2 text-sm font-semibold text-foreground shadow-xs outline-none transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                    year === anchorParts.year &&
                      'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90',
                  )}
                  dir="ltr"
                  key={year}
                  onClick={() => {
                    setAnchor((current) =>
                      setCalendarMonthYear(
                        current,
                        year,
                        anchorParts.month,
                        calendarSystem,
                      ),
                    );
                    setCalendarView('months');
                  }}
                  type="button"
                >
                  {formatCalendarNumber(year, calendarSystem)}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1 text-center">
              {weekdayLabels[calendarSystem].map((label, index) => (
                <span
                  className="py-1 text-xs font-bold text-primary"
                  key={`${label}-${index}`}
                >
                  {label}
                </span>
              ))}
              {days.map((day) => {
                const selected = day.isoDate === selectedDate;
                return (
                  <button
                    aria-label={`${day.year}/${day.month}/${day.day}`}
                    aria-pressed={selected}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                      day.isCurrentMonth
                        ? 'text-foreground hover:bg-primary/10'
                        : 'text-muted-foreground/45',
                      day.isToday &&
                        !selected &&
                        'border border-primary font-bold text-primary',
                      selected &&
                        'bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90',
                    )}
                    key={day.isoDate}
                    onClick={() => selectDay(day.isoDate)}
                    type="button"
                  >
                    {formatCalendarNumber(day.day, calendarSystem)}
                  </button>
                );
              })}
            </div>
          )}

          {includeTime ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
              <Clock3 aria-hidden="true" className="size-4 text-primary" />
              <label className="text-xs font-semibold" htmlFor={`${id}-time`}>
                ساعت
              </label>
              <input
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-surface px-2 text-center text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                id={`${id}-time`}
                onChange={(event) => {
                  const date = selectedDate || toIsoDate(new Date());
                  emit(`${date}T${event.target.value}`);
                }}
                type="time"
                value={/T(\d{2}:\d{2})/.exec(currentValue)?.[1] ?? '00:00'}
              />
              <button
                className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(false)}
                type="button"
              >
                تأیید
              </button>
            </div>
          ) : null}

          {required ? (
            <span className="sr-only">انتخاب تاریخ الزامی است.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
