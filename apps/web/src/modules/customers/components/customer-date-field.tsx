'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import {
  calendarMonthDays,
  calendarMonthTitle,
  currentPersianParts,
  formatCustomerDate,
  gregorianParts,
  persianNumber,
  shiftCalendarMonth,
} from '../model/customer-calendar';

export type CustomerCalendarMode = 'persian' | 'gregorian';

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
}: {
  id: string;
  label: string;
  mode: CustomerCalendarMode;
  onModeChange: (mode: CustomerCalendarMode) => void;
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
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
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const days = useMemo(
    () => calendarMonthDays(mode, view.year, view.month),
    [mode, view.month, view.year],
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <FormField id={id} label={label}>
      <div className="relative" ref={rootRef}>
        <div className="flex items-center gap-2">
          <button
            aria-expanded={open}
            aria-haspopup="dialog"
            className="flex h-11 min-w-0 flex-1 items-center justify-between rounded-xl border border-primary/30 bg-primary/[0.03] px-3 text-sm outline-none transition hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            data-calendar-theme="dashboard-blue"
            disabled={disabled}
            id={id}
            onClick={() => {
              if (!open)
                setView({ year: selected.year, month: selected.month });
              setOpen((current) => !current);
            }}
            type="button"
          >
            <span className={cn('truncate', !value && 'text-muted-foreground')}>
              {value ? formatCustomerDate(value, mode) : 'انتخاب تاریخ'}
            </span>
            <CalendarDays className="size-4 shrink-0 text-primary" />
          </button>
          <CustomerCalendarSwitch
            mode={mode}
            onChange={(nextMode) => {
              const nextSelected =
                nextMode === 'persian'
                  ? currentPersianParts(value)
                  : gregorianParts(value);
              setView({
                year: nextSelected.year,
                month: nextSelected.month,
              });
              onModeChange(nextMode);
            }}
          />
        </div>

        {open ? (
          <div
            aria-label={`تقویم ${label}`}
            className="absolute start-0 top-full z-50 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-popover p-3 text-popover-foreground shadow-2xl"
            role="dialog"
          >
            <div className="flex items-center justify-between rounded-xl bg-primary px-2 py-2 text-primary-foreground">
              <Button
                aria-label="ماه قبل"
                className="size-8 p-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
                onClick={() =>
                  setView((current) => shiftCalendarMonth(current, -1))
                }
                type="button"
                variant="ghost"
              >
                <ChevronRight className="size-4" />
              </Button>
              <p className="text-sm font-bold">
                {calendarMonthTitle(mode, view.year, view.month)}
              </p>
              <Button
                aria-label="ماه بعد"
                className="size-8 p-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
                onClick={() =>
                  setView((current) => shiftCalendarMonth(current, 1))
                }
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="size-4" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground">
              {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((day) => (
                <span
                  className={day === 'ج' ? 'text-destructive' : ''}
                  key={day}
                >
                  {day}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-0.5">
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
                      onChange(day.iso);
                      setOpen(false);
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
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
              <Button
                onClick={() => {
                  onChange(today);
                  setOpen(false);
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
                    onChange('');
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
          </div>
        ) : null}
      </div>
    </FormField>
  );
}
