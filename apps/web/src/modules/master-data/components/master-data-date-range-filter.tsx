'use client';

import type { MasterDataListQuery } from '@rubi/contracts';
import { CalendarRange, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { DatePicker } from '@/components/ui/date-picker';

type DateRangeQuery = Pick<MasterDataListQuery, 'createdFrom' | 'createdTo'>;

interface MasterDataDateRangeFilterProps {
  fromDate: string;
  idPrefix: string;
  onFromDateChange: (value: string) => void;
  onReset: () => void;
  onToDateChange: (value: string) => void;
  toDate: string;
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

export function useMasterDataDateRange(onChange: () => void) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const onFromDateChange = useCallback(
    (value: string) => {
      const next = dateOnly(value);
      setFromDate(next);
      setToDate((current) => (current && next > current ? '' : current));
      onChange();
    },
    [onChange],
  );
  const onToDateChange = useCallback(
    (value: string) => {
      const next = dateOnly(value);
      setToDate(next);
      setFromDate((current) => (current && next < current ? '' : current));
      onChange();
    },
    [onChange],
  );
  const reset = useCallback(() => {
    setFromDate('');
    setToDate('');
    onChange();
  }, [onChange]);
  const filters = useMemo<Partial<DateRangeQuery>>(
    () => ({
      ...(fromDate ? { createdFrom: fromDate } : {}),
      ...(toDate ? { createdTo: toDate } : {}),
    }),
    [fromDate, toDate],
  );

  return {
    filters,
    props: {
      fromDate,
      onFromDateChange,
      onReset: reset,
      onToDateChange,
      toDate,
    },
    reset,
  };
}

export function MasterDataDateRangeFilter({
  fromDate,
  idPrefix,
  onFromDateChange,
  onReset,
  onToDateChange,
  toDate,
}: MasterDataDateRangeFilterProps) {
  const hasValue = Boolean(fromDate || toDate);

  return (
    <fieldset className="min-w-0 rounded-xl border border-input/80 bg-background/70 px-2 pb-2 pt-1 shadow-xs sm:col-span-2 xl:col-span-2">
      <legend className="px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <CalendarRange aria-hidden="true" className="size-3.5 text-primary" />
          بازه تاریخ
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            شمسی / میلادی
          </span>
        </span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0 space-y-1" htmlFor={`${idPrefix}-from-date`}>
          <span className="block text-[11px] font-medium text-muted-foreground">
            از تاریخ
          </span>
          <DatePicker
            className="[&_button]:h-9 [&_button]:rounded-lg [&_button]:px-2 [&_button]:text-xs"
            id={`${idPrefix}-from-date`}
            onChange={onFromDateChange}
            placeholder="شروع بازه"
            value={fromDate}
          />
        </label>
        <label className="min-w-0 space-y-1" htmlFor={`${idPrefix}-to-date`}>
          <span className="block text-[11px] font-medium text-muted-foreground">
            تا تاریخ
          </span>
          <DatePicker
            className="[&_button]:h-9 [&_button]:rounded-lg [&_button]:px-2 [&_button]:text-xs"
            id={`${idPrefix}-to-date`}
            onChange={onToDateChange}
            placeholder="پایان بازه"
            value={toDate}
          />
        </label>
      </div>
      {hasValue ? (
        <button
          aria-label="پاک‌کردن بازه تاریخ"
          className="mt-1 inline-flex min-h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onReset}
          type="button"
        >
          <X aria-hidden="true" className="size-3" />
          پاک‌کردن بازه
        </button>
      ) : null}
    </fieldset>
  );
}
