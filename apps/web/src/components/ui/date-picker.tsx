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
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState(
    () => parseIsoDate(currentValue) ?? new Date(),
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedDate = currentValue.slice(0, 10);
  const days = calendarMonthDays(anchor, calendarSystem);
  const anchorParts = calendarParts(anchor, calendarSystem);
  const yearOptions = React.useMemo(
    () =>
      Array.from({ length: 121 }, (_, index) => anchorParts.year - 100 + index),
    [anchorParts.year],
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
                onClick={() => setCalendarSystem(system)}
                type="button"
              >
                {system === 'persian' ? 'شمسی' : 'میلادی'}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-primary px-2 py-2 text-primary-foreground">
            <button
              aria-label="ماه قبل"
              className="flex size-9 items-center justify-center rounded-lg outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              onClick={() =>
                setAnchor((current) =>
                  moveCalendarMonth(current, -1, calendarSystem),
                )
              }
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
            <div
              aria-label="انتخاب مستقیم ماه و سال"
              className="grid min-w-0 flex-1 grid-cols-2 gap-1"
            >
              <select
                aria-label="ماه"
                className="h-9 min-w-0 rounded-lg border border-white/20 bg-white/10 px-2 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-white [&>option]:text-foreground"
                onChange={(event) =>
                  setAnchor((current) =>
                    setCalendarMonthYear(
                      current,
                      anchorParts.year,
                      Number(event.target.value),
                      calendarSystem,
                    ),
                  )
                }
                value={anchorParts.month}
              >
                {monthOptions.map((option) => (
                  <option key={option.month} value={option.month}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="سال"
                className="h-9 min-w-0 rounded-lg border border-white/20 bg-white/10 px-2 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-white [&>option]:text-foreground"
                dir="ltr"
                onChange={(event) =>
                  setAnchor((current) =>
                    setCalendarMonthYear(
                      current,
                      Number(event.target.value),
                      anchorParts.month,
                      calendarSystem,
                    ),
                  )
                }
                value={anchorParts.year}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {calendarSystem === 'gregorian'
                      ? new Intl.NumberFormat('en-US', {
                          useGrouping: false,
                        }).format(year)
                      : new Intl.NumberFormat('fa-IR', {
                          useGrouping: false,
                        }).format(year)}
                  </option>
                ))}
              </select>
              <span className="sr-only">
                {calendarMonthLabel(anchor, calendarSystem)}
              </span>
            </div>
            <button
              aria-label="ماه بعد"
              className="flex size-9 items-center justify-center rounded-lg outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
              onClick={() =>
                setAnchor((current) =>
                  moveCalendarMonth(current, 1, calendarSystem),
                )
              }
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
          </div>

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
                  {new Intl.NumberFormat(
                    calendarSystem === 'gregorian' ? 'en-US' : 'fa-IR',
                    { useGrouping: false },
                  ).format(day.day)}
                </button>
              );
            })}
          </div>

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
