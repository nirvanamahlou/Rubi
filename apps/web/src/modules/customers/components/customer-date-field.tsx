'use client';

import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  currentPersianParts,
  formatCustomerDate,
  persianDateToIso,
  persianMonths,
  persianNumber,
  persianParts,
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
      className="inline-flex rounded-xl border border-primary/25 bg-primary/5 p-1"
      role="group"
    >
      <Button
        onClick={() => onChange('persian')}
        size="sm"
        type="button"
        variant={mode === 'persian' ? 'primary' : 'ghost'}
      >
        شمسی
      </Button>
      <Button
        onClick={() => onChange('gregorian')}
        size="sm"
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
  onChange,
  value,
  disabled = false,
}: {
  id: string;
  label: string;
  mode: CustomerCalendarMode;
  onChange: (value: string) => void;
  value: string;
  disabled?: boolean;
}) {
  const selected = currentPersianParts(value);
  const currentYear = persianParts(new Date()).year;
  const years = useMemo(
    () => Array.from({ length: 106 }, (_, index) => currentYear + 5 - index),
    [currentYear],
  );
  const daysInMonth = selected.month <= 6 ? 31 : selected.month <= 11 ? 30 : 30;

  function updatePersian(
    patch: Partial<{ year: number; month: number; day: number }>,
  ) {
    let next = { ...selected, ...patch };
    let iso = persianDateToIso(next);
    while (!iso && next.day > 28) {
      next = { ...next, day: next.day - 1 };
      iso = persianDateToIso(next);
    }
    if (iso) onChange(iso);
  }

  return (
    <FormField id={id} label={label}>
      {mode === 'gregorian' ? (
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute end-3 top-3.5 size-4 text-primary" />
          <Input
            className="border-primary/30 bg-primary/[0.03] pe-10 focus:border-primary"
            data-calendar-theme="dashboard-blue"
            disabled={disabled}
            id={id}
            onChange={(event) => onChange(event.target.value)}
            type="date"
            value={value}
          />
        </div>
      ) : (
        <div
          className="grid grid-cols-[1fr_1.35fr_0.8fr] gap-2 rounded-xl border border-primary/30 bg-primary/[0.03] p-2"
          data-calendar-theme="dashboard-blue"
          id={id}
        >
          <Select
            disabled={disabled}
            onValueChange={(year) => updatePersian({ year: Number(year) })}
            value={String(selected.year)}
          >
            <SelectTrigger aria-label={`سال ${label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {persianNumber(year)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            disabled={disabled}
            onValueChange={(month) => updatePersian({ month: Number(month) })}
            value={String(selected.month)}
          >
            <SelectTrigger aria-label={`ماه ${label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {persianMonths.map((month, index) => (
                <SelectItem key={month} value={String(index + 1)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            disabled={disabled}
            onValueChange={(day) => updatePersian({ day: Number(day) })}
            value={String(selected.day)}
          >
            <SelectTrigger aria-label={`روز ${label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(
                (day) => (
                  <SelectItem key={day} value={String(day)}>
                    {persianNumber(day)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {value ? formatCustomerDate(value, mode) : 'تاریخی انتخاب نشده است.'}
        </span>
        {!disabled ? (
          <Button
            onClick={() =>
              onChange(value ? '' : new Date().toISOString().slice(0, 10))
            }
            size="sm"
            type="button"
            variant="ghost"
          >
            {value ? 'پاک‌کردن' : 'انتخاب امروز'}
          </Button>
        ) : null}
      </div>
    </FormField>
  );
}
