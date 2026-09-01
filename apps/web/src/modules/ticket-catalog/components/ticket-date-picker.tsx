'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  calendarMonthDays,
  calendarParts,
  formatCalendarValue,
  joinDateAndTime,
  moveCalendarMonth,
  parseIsoDate,
  toIsoDate,
  type CalendarSystem,
} from '@/components/ui/date-picker.utils';
import { cn } from '@/lib/utils';

const monthLabels = {
  persian: [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ],
  gregorian: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
} satisfies Record<CalendarSystem, string[]>;
const weekdayLabels = {
  persian: ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'],
  gregorian: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} satisfies Record<CalendarSystem, string[]>;
type TicketCalendarView = 'days' | 'months' | 'years';
const formatNumber = (value: number) =>
  new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(value);

export function moveToCalendarMonth(
  anchor: Date,
  targetYear: number,
  targetMonth: number,
  system: CalendarSystem,
): Date {
  const current = calendarParts(anchor, system);
  const delta = (targetYear - current.year) * 12 + targetMonth - current.month;
  if (!Number.isSafeInteger(delta) || Math.abs(delta) > 480)
    throw new Error('سال انتخابی خارج از بازه تقویم بلیت است.');
  let next = anchor;
  const direction: -1 | 1 = delta < 0 ? -1 : 1;
  for (let index = 0; index < Math.abs(delta); index += 1)
    next = moveCalendarMonth(next, direction, system);
  return next;
}

export interface TicketDatePickerProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  calendarSystem?: CalendarSystem;
  onCalendarSystemChange?: (value: CalendarSystem) => void;
  includeTime?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean;
}

export function TicketDatePicker({
  calendarSystem: controlledCalendarSystem,
  className,
  defaultValue = '',
  disabled,
  id,
  includeTime = false,
  name,
  onCalendarSystemChange,
  onChange,
  placeholder = 'انتخاب تاریخ',
  readOnly,
  required,
  value,
  ...ariaProps
}: TicketDatePickerProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [internalCalendarSystem, setInternalCalendarSystem] =
    React.useState<CalendarSystem>('persian');
  const calendarSystem = controlledCalendarSystem ?? internalCalendarSystem;
  const currentValue = value ?? internalValue;
  const [open, setOpen] = React.useState(false);
  const [calendarView, setCalendarView] =
    React.useState<TicketCalendarView>('days');
  const [anchor, setAnchor] = React.useState(
    () => parseIsoDate(currentValue) ?? new Date(),
  );
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedDate = currentValue.slice(0, 10);
  const currentParts = calendarParts(anchor, calendarSystem);
  const days = calendarMonthDays(anchor, calendarSystem);
  const today = toIsoDate(new Date());

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
  const setSystem = (system: CalendarSystem) => {
    if (controlledCalendarSystem === undefined)
      setInternalCalendarSystem(system);
    onCalendarSystemChange?.(system);
    setAnchor(parseIsoDate(currentValue) ?? new Date());
    setCalendarView('days');
  };
  const shiftRange = (direction: -1 | 1) => {
    setAnchor((current) => {
      if (calendarView === 'days')
        return moveCalendarMonth(current, direction, calendarSystem);
      const parts = calendarParts(current, calendarSystem);
      return moveToCalendarMonth(
        current,
        parts.year + direction * (calendarView === 'years' ? 12 : 1),
        parts.month,
        calendarSystem,
      );
    });
  };

  return (
    <div className={cn('relative w-full', className)} ref={rootRef}>
      <input name={name} type="hidden" value={currentValue} />
      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button
          {...ariaProps}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'flex h-11 min-w-0 flex-1 items-center justify-between rounded-xl border border-primary/30 bg-primary/[0.03] px-3 text-sm outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
            !currentValue && 'text-muted-foreground',
          )}
          data-calendar-theme="dashboard-blue"
          disabled={disabled || readOnly}
          id={id}
          onClick={() => {
            if (!open) setAnchor(parseIsoDate(currentValue) ?? new Date());
            setCalendarView('days');
            setOpen((current) => !current);
          }}
          type="button"
        >
          <span className="truncate">
            {currentValue
              ? formatCalendarValue(currentValue, calendarSystem, includeTime)
              : placeholder}
          </span>
          <CalendarDays
            aria-hidden="true"
            className="size-4 shrink-0 text-primary"
          />
        </button>
        <div
          aria-label="نوع تقویم"
          className="inline-flex shrink-0 justify-self-start rounded-lg border border-primary/25 bg-primary/5 p-0.5"
          role="group"
        >
          <Button
            className="h-8 rounded-md px-2.5 text-xs"
            onClick={() => setSystem('persian')}
            type="button"
            variant={calendarSystem === 'persian' ? 'primary' : 'ghost'}
          >
            شمسی
          </Button>
          <Button
            className="h-8 rounded-md px-2.5 text-xs"
            onClick={() => setSystem('gregorian')}
            type="button"
            variant={calendarSystem === 'gregorian' ? 'primary' : 'ghost'}
          >
            میلادی
          </Button>
        </div>
      </div>

      {open ? (
        <div
          aria-label="انتخاب تاریخ"
          className="absolute start-0 top-full z-[70] mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-popover p-3 text-popover-foreground shadow-2xl"
          role="dialog"
        >
          <div className="flex items-center justify-between rounded-xl bg-primary px-2 py-2 text-primary-foreground">
            <Button
              aria-label="بازه قبل"
              className="size-8 p-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              onClick={() => shiftRange(-1)}
              type="button"
              variant="ghost"
            >
              <ChevronRight className="size-4" />
            </Button>
            <div className="flex items-center gap-1 text-sm font-bold">
              <button
                aria-label="انتخاب ماه"
                className="rounded-md px-2 py-1 outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                dir={calendarSystem === 'gregorian' ? 'ltr' : 'rtl'}
                onClick={() => setCalendarView('months')}
                type="button"
              >
                {monthLabels[calendarSystem][currentParts.month - 1]}
              </button>
              <button
                aria-label="انتخاب سال"
                className="rounded-md px-2 py-1 outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                onClick={() => setCalendarView('years')}
                type="button"
              >
                {formatNumber(currentParts.year)}
              </button>
            </div>
            <Button
              aria-label="بازه بعد"
              className="size-8 p-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              onClick={() => shiftRange(1)}
              type="button"
              variant="ghost"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>

          {calendarView === 'days' ? (
            <>
              <div
                className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground"
                dir={calendarSystem === 'gregorian' ? 'ltr' : 'rtl'}
              >
                {weekdayLabels[calendarSystem].map((day, index) => (
                  <span
                    className={
                      day === 'ج' || day === 'Fri' ? 'text-destructive' : ''
                    }
                    key={`${day}-${index}`}
                  >
                    {day}
                  </span>
                ))}
              </div>
              <div
                className="mt-1 grid grid-cols-7 gap-0.5"
                dir={calendarSystem === 'gregorian' ? 'ltr' : 'rtl'}
              >
                {days.map((day, index) =>
                  day.isCurrentMonth ? (
                    <button
                      aria-label={`${day.year}/${day.month}/${day.day}`}
                      aria-pressed={day.isoDate === selectedDate}
                      className={cn(
                        'flex size-9 items-center justify-center justify-self-center rounded-lg text-xs font-medium outline-none transition hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                        day.isoDate === selectedDate &&
                          'bg-primary text-primary-foreground hover:bg-primary',
                        day.isoDate !== selectedDate &&
                          day.isToday &&
                          'border border-primary text-primary',
                      )}
                      key={day.isoDate}
                      onClick={() => selectDay(day.isoDate)}
                      type="button"
                    >
                      {formatNumber(day.day)}
                    </button>
                  ) : (
                    <span aria-hidden="true" key={`empty-${index}`} />
                  ),
                )}
              </div>
            </>
          ) : calendarView === 'months' ? (
            <div className="mt-3 grid grid-cols-3 gap-2" dir="rtl">
              {monthLabels[calendarSystem].map((label, index) => (
                <button
                  aria-pressed={currentParts.month === index + 1}
                  className={cn(
                    'min-h-11 rounded-xl border border-primary/10 px-2 py-2 text-xs font-semibold outline-none transition hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                    currentParts.month === index + 1 &&
                      'border-primary bg-primary text-primary-foreground hover:bg-primary',
                  )}
                  dir={calendarSystem === 'gregorian' ? 'ltr' : 'rtl'}
                  key={label}
                  onClick={() => {
                    setAnchor((current) =>
                      moveToCalendarMonth(
                        current,
                        currentParts.year,
                        index + 1,
                        calendarSystem,
                      ),
                    );
                    setCalendarView('days');
                  }}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from(
                { length: 12 },
                (_, index) => currentParts.year - 5 + index,
              ).map((year) => (
                <button
                  aria-pressed={currentParts.year === year}
                  className={cn(
                    'min-h-11 rounded-xl border border-primary/10 px-2 py-2 text-sm font-semibold outline-none transition hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                    currentParts.year === year &&
                      'border-primary bg-primary text-primary-foreground hover:bg-primary',
                  )}
                  key={year}
                  onClick={() => {
                    setAnchor((current) =>
                      moveToCalendarMonth(
                        current,
                        year,
                        currentParts.month,
                        calendarSystem,
                      ),
                    );
                    setCalendarView('months');
                  }}
                  type="button"
                >
                  {formatNumber(year)}
                </button>
              ))}
            </div>
          )}

          {includeTime && calendarView === 'days' ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
              <Clock3 aria-hidden="true" className="size-4 text-primary" />
              <label className="text-xs font-semibold" htmlFor={`${id}-time`}>
                ساعت
              </label>
              <input
                className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-surface px-2 text-center text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                id={`${id}-time`}
                onChange={(event) => {
                  const date = selectedDate || today;
                  emit(`${date}T${event.target.value}`);
                }}
                type="time"
                value={/T(\d{2}:\d{2})/.exec(currentValue)?.[1] ?? '00:00'}
              />
              <Button onClick={() => setOpen(false)} size="sm" type="button">
                تأیید
              </Button>
            </div>
          ) : null}

          {calendarView === 'days' ? (
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
              <Button
                onClick={() => {
                  emit(joinDateAndTime(today, currentValue, includeTime));
                  if (!includeTime) setOpen(false);
                }}
                size="sm"
                type="button"
                variant="secondary"
              >
                امروز
              </Button>
              {currentValue && !required ? (
                <Button
                  onClick={() => {
                    emit('');
                    setOpen(false);
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  پاک‌کردن
                </Button>
              ) : null}
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
