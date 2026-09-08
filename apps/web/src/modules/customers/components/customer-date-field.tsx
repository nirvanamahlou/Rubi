'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { resolveCalendarPopoverPosition } from '@/components/ui/date-picker.utils';
import { cn } from '@/lib/utils';
import {
  calendarMonthDays,
  calendarMonthName,
  calendarMonthTitle,
  calendarYearLabel,
  currentPersianParts,
  formatCustomerDate,
  gregorianParts,
  persianNumber,
  shiftCalendarMonth,
} from '../model/customer-calendar';

export type CustomerCalendarMode = 'persian' | 'gregorian';
type CustomerCalendarView = 'days' | 'months' | 'years';

export function CustomerCalendarSwitch({
  mode,
  onChange,
}: {
  mode: CustomerCalendarMode;
  onChange: (mode: CustomerCalendarMode) => void;
}) {
  return (
    <div
      aria-label="نوع تقویم Customers"
      className="inline-flex shrink-0 rounded-lg border border-primary/25 bg-primary/5 p-0.5"
      role="group"
    >
      <Button
        onClick={() => onChange('persian')}
        className="h-8 rounded-md px-2.5 text-xs"
        type="button"
        variant={mode === 'persian' ? 'primary' : 'ghost'}
      >
        شمسی
      </Button>
      <Button
        onClick={() => onChange('gregorian')}
        className="h-8 rounded-md px-2.5 text-xs"
        type="button"
        variant={mode === 'gregorian' ? 'primary' : 'ghost'}
      >
        میلادی
      </Button>
    </div>
  );
}

export function CustomerDateField({
  id,
  label,
  mode,
  onModeChange,
  onChange,
  value,
  disabled = false,
  initialOpen = false,
  compact = false,
}: {
  id: string;
  label: string;
  mode: CustomerCalendarMode;
  onModeChange: (mode: CustomerCalendarMode) => void;
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean;
  initialOpen?: boolean;
  compact?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(initialOpen);
  const [calendarView, setCalendarView] =
    useState<CustomerCalendarView>('days');
  const selected = useMemo(
    () =>
      mode === 'persian' ? currentPersianParts(value) : gregorianParts(value),
    [mode, value],
  );
  const [view, setView] = useState({
    year: selected.year,
    month: selected.month,
  });

  useEffect(() => {
    if (!open || disabled) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // Close only the calendar, not the surrounding customer form.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape, true);
    };
  }, [open, disabled]);

  useEffect(() => {
    if (!compact || !open || disabled) return;
    const popover = popoverRef.current;
    const trigger = triggerRef.current;
    if (!popover || !trigger) return;
    // The native top layer escapes table overflow and transformed modal parents
    // without adding a second modal or moving content outside the form's focus scope.
    popover.showPopover();
    function position() {
      if (!popover || !trigger) return;
      const placement = resolveCalendarPopoverPosition(
        trigger.getBoundingClientRect(),
        { height: popover.scrollHeight, width: popover.offsetWidth },
        { height: window.innerHeight, width: window.innerWidth },
      );
      Object.assign(popover.style, {
        left: `${placement.left}px`,
        top: `${placement.top}px`,
        maxHeight: `${placement.maxHeight}px`,
      });
    }
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    const observer = new ResizeObserver(position);
    observer.observe(popover);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      if (popover.matches(':popover-open')) popover.hidePopover();
    };
  }, [compact, open, disabled]);

  function selectDate(nextValue: string) {
    if (disabled) return;
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const calendarSwitch = (
    <CustomerCalendarSwitch
      mode={mode}
      onChange={(nextMode) => {
        const nextSelected =
          nextMode === 'persian'
            ? currentPersianParts(value)
            : gregorianParts(value);
        setView({ year: nextSelected.year, month: nextSelected.month });
        setCalendarView('days');
        onModeChange(nextMode);
      }}
    />
  );

  const days = useMemo(
    () => calendarMonthDays(mode, view.year, view.month),
    [mode, view.month, view.year],
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      className={
        compact ? 'min-w-40 [&_label]:sr-only [&>div]:gap-0' : undefined
      }
    >
      <FormField id={id} label={label}>
        <div className="relative" ref={rootRef}>
          <div className="flex items-center gap-2">
            <button
              ref={triggerRef}
              aria-label={label}
              aria-controls={open && !disabled ? `${id}-calendar` : undefined}
              aria-expanded={open && !disabled}
              aria-haspopup="dialog"
              className={cn(
                'flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/[0.03] px-3 text-sm outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
                compact && 'h-10 rounded-md text-xs',
              )}
              data-calendar-theme="dashboard-blue"
              disabled={disabled}
              id={id}
              onClick={() => {
                if (!open)
                  setView({ year: selected.year, month: selected.month });
                setCalendarView('days');
                setOpen((current) => !current);
              }}
              type="button"
            >
              <span
                className={cn('truncate', !value && 'text-muted-foreground')}
              >
                {value ? formatCustomerDate(value, mode) : 'انتخاب تاریخ'}
              </span>
              <CalendarDays className="size-4 shrink-0 text-primary" />
            </button>
            {!compact && calendarSwitch}
          </div>

          {open && !disabled ? (
            <div
              aria-label={`تقویم ${label}`}
              aria-modal="false"
              id={`${id}-calendar`}
              ref={popoverRef}
              popover={compact ? 'manual' : undefined}
              className={cn(
                'z-50 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-popover p-3 text-popover-foreground shadow-2xl',
                compact
                  ? 'fixed inset-auto m-0 overflow-y-auto'
                  : 'absolute start-0 top-full mt-2',
              )}
              role="dialog"
            >
              {compact && (
                <div className="mb-2 flex justify-end">{calendarSwitch}</div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-primary px-2 py-2 text-primary-foreground">
                <Button
                  aria-label="بازه قبل"
                  className="size-8 p-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
                  onClick={() =>
                    setView((current) =>
                      calendarView === 'days'
                        ? shiftCalendarMonth(current, -1)
                        : {
                            ...current,
                            year:
                              current.year -
                              (calendarView === 'years' ? 12 : 1),
                          },
                    )
                  }
                  type="button"
                  variant="ghost"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <div className="flex items-center gap-1 text-sm font-bold">
                  <button
                    className="rounded-md px-2 py-1 outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                    dir={mode === 'gregorian' ? 'ltr' : 'rtl'}
                    onClick={() => setCalendarView('months')}
                    type="button"
                  >
                    {calendarMonthName(mode, view.month)}
                  </button>
                  <button
                    aria-label="انتخاب سال"
                    className="rounded-md px-2 py-1 outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70"
                    onClick={() => setCalendarView('years')}
                    type="button"
                  >
                    {calendarYearLabel(mode, view.year)}
                  </button>
                </div>
                <Button
                  aria-label="بازه بعد"
                  className="size-8 p-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
                  onClick={() =>
                    setView((current) =>
                      calendarView === 'days'
                        ? shiftCalendarMonth(current, 1)
                        : {
                            ...current,
                            year:
                              current.year +
                              (calendarView === 'years' ? 12 : 1),
                          },
                    )
                  }
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
                    dir={mode === 'gregorian' ? 'ltr' : 'rtl'}
                  >
                    {(mode === 'gregorian'
                      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                      : ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
                    ).map((day) => (
                      <span
                        className={
                          day === 'ج' || day === 'Fri' ? 'text-destructive' : ''
                        }
                        key={day}
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                  <div
                    className="mt-1 grid grid-cols-7 gap-0.5"
                    dir={mode === 'gregorian' ? 'ltr' : 'rtl'}
                  >
                    {days.map((day, index) =>
                      day ? (
                        <button
                          aria-label={`${persianNumber(day.day)} ${calendarMonthTitle(mode, view.year, view.month)}`}
                          aria-pressed={value === day.iso}
                          className={cn(
                            'flex size-9 items-center justify-center justify-self-center rounded-lg text-xs font-medium outline-none transition hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                            value === day.iso &&
                              'bg-primary text-primary-foreground hover:bg-primary',
                            value !== day.iso &&
                              day.iso === today &&
                              'border border-primary text-primary',
                          )}
                          key={day.iso}
                          onClick={() => {
                            selectDate(day.iso);
                          }}
                          type="button"
                        >
                          {persianNumber(day.day)}
                        </button>
                      ) : (
                        <span aria-hidden="true" key={`empty-${index}`} />
                      ),
                    )}
                  </div>
                </>
              ) : calendarView === 'months' ? (
                <div className="mt-3 grid grid-cols-3 gap-2" dir="rtl">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(
                    (month) => (
                      <button
                        aria-pressed={view.month === month}
                        className={cn(
                          'min-h-11 rounded-xl border border-primary/10 px-2 py-2 text-xs font-semibold outline-none transition hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                          view.month === month &&
                            'border-primary bg-primary text-primary-foreground hover:bg-primary',
                        )}
                        dir={mode === 'gregorian' ? 'ltr' : 'rtl'}
                        key={month}
                        onClick={() => {
                          setView((current) => ({ ...current, month }));
                          setCalendarView('days');
                        }}
                        type="button"
                      >
                        {calendarMonthName(mode, month)}
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {Array.from(
                    { length: 12 },
                    (_, index) => view.year - 5 + index,
                  ).map((year) => (
                    <button
                      aria-pressed={view.year === year}
                      className={cn(
                        'min-h-11 rounded-xl border border-primary/10 px-2 py-2 text-sm font-semibold outline-none transition hover:border-primary/40 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring',
                        view.year === year &&
                          'border-primary bg-primary text-primary-foreground hover:bg-primary',
                      )}
                      key={year}
                      onClick={() => {
                        setView((current) => ({ ...current, year }));
                        setCalendarView('months');
                      }}
                      type="button"
                    >
                      {calendarYearLabel(mode, year)}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                <Button
                  onClick={() => {
                    selectDate(today);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  امروز
                </Button>
                {value ? (
                  <Button
                    onClick={() => {
                      selectDate('');
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    پاک‌کردن
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </FormField>
    </div>
  );
}
