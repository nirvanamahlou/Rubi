'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  calendarMonthDays,
  calendarMonthLabel,
  formatCalendarValue,
  joinDateAndTime,
  moveCalendarMonth,
  parseIsoDate,
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
  variant?: 'default' | 'rubi';
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
  variant = 'default',
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
  const rubiCalendar = variant === 'rubi';

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
          rubiCalendar &&
            'border-primary/20 bg-gradient-to-l from-surface via-surface to-primary/5 shadow-sm shadow-primary/5 hover:border-primary/45 hover:shadow-md hover:shadow-primary/10 focus-visible:border-primary',
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
        <span
          className={cn(
            'shrink-0',
            rubiCalendar &&
              'grid size-8 place-items-center rounded-lg border border-primary/15 bg-primary/10 shadow-inner',
          )}
        >
          <CalendarDays aria-hidden="true" className="size-5 text-primary" />
        </span>
      </button>

      {open ? (
        <div
          aria-label="انتخاب تاریخ"
          className={cn(
            'absolute start-0 top-[calc(100%+0.5rem)] z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-primary/25 bg-popover p-3 text-popover-foreground shadow-2xl shadow-primary/15',
            rubiCalendar &&
              'overflow-hidden border-primary/30 bg-gradient-to-b from-popover via-popover to-primary/5 p-0 shadow-[0_22px_55px_-24px_color-mix(in_srgb,var(--primary)_55%,transparent)] ring-1 ring-primary/10 backdrop-blur-xl',
          )}
          dir="rtl"
          role="dialog"
        >
          {rubiCalendar ? (
            <div
              aria-hidden="true"
              className="h-1 bg-gradient-to-l from-primary via-sky-500 to-cyan-400"
            />
          ) : null}
          <div className={cn(rubiCalendar && 'p-3')}>
            <div
              aria-label="نوع تقویم"
              className={cn(
                'mb-3 grid grid-cols-2 rounded-xl bg-secondary p-1',
                rubiCalendar &&
                  'border border-primary/15 bg-primary/5 p-1.5 shadow-inner',
              )}
              role="group"
            >
              {(['persian', 'gregorian'] as const).map((system) => (
                <button
                  aria-pressed={calendarSystem === system}
                  className={cn(
                    'min-h-9 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                    calendarSystem === system
                      ? rubiCalendar
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                        : 'bg-primary text-primary-foreground shadow-sm'
                      : rubiCalendar
                        ? 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
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

            <div
              className={cn(
                'mb-3 flex items-center justify-between rounded-xl bg-primary px-2 py-2 text-primary-foreground',
                rubiCalendar &&
                  'relative overflow-hidden bg-gradient-to-l from-primary via-primary to-sky-700 shadow-lg shadow-primary/20 dark:to-sky-500',
              )}
            >
              {rubiCalendar ? (
                <span
                  aria-hidden="true"
                  className="absolute -start-6 -top-8 size-24 rounded-full bg-white/15 blur-2xl"
                />
              ) : null}
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
              <strong className="relative text-sm">
                {calendarMonthLabel(anchor, calendarSystem)}
              </strong>
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
                  className={cn(
                    'py-1 text-xs font-bold text-primary',
                    rubiCalendar && 'rounded-md bg-primary/5 py-1.5',
                  )}
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
                      rubiCalendar &&
                        'border border-transparent hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-sm',
                      day.isCurrentMonth
                        ? 'text-foreground hover:bg-primary/10'
                        : 'text-muted-foreground/45',
                      day.isToday &&
                        !selected &&
                        (rubiCalendar
                          ? 'border-primary/40 bg-primary/5 font-black text-primary ring-1 ring-primary/15'
                          : 'border border-primary font-bold text-primary'),
                      selected &&
                        (rubiCalendar
                          ? 'border-primary bg-primary font-black text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90'
                          : 'bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90'),
                    )}
                    key={day.isoDate}
                    onClick={() => selectDay(day.isoDate)}
                    type="button"
                  >
                    {new Intl.NumberFormat('fa-IR').format(day.day)}
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
        </div>
      ) : null}
    </div>
  );
}
