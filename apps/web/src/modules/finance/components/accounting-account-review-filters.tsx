'use client';

import { useMemo, useState } from 'react';
import { detailDigits, type AccountingSnapshotV1 } from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input } from '@/components/ui/form-controls';
import {
  defaultReviewFilters,
  fiscalReviewMonths,
  reviewStatuses,
  type ReviewFilters,
} from '../accounting-review-navigation';
import { AccountingButton as Button } from './accounting-operations';

const fieldClass = 'w-full rounded border bg-background px-2 py-2 text-sm';

function MultiFilter({
  label,
  value,
  options,
  onChange,
  searchable = false,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const selected = value ? value.split(',') : [];
  const visible = options.filter((item) => item.label.includes(search.trim()));
  return (
    <details className="rounded border px-3 py-2">
      <summary className="cursor-pointer text-sm">
        {label} ({selected.length})
      </summary>
      {searchable && (
        <Input
          aria-label="جستجوی حساب"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      )}
      <div className="mt-2 grid max-h-44 gap-1 overflow-auto">
        {visible.map((item) => (
          <label className="flex gap-2 text-sm" key={item.id}>
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              disabled={!selected.includes(item.id) && selected.length >= 100}
              onChange={(event) =>
                onChange(
                  (event.target.checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id)
                  ).join(','),
                )
              }
            />
            {item.label}
          </label>
        ))}
      </div>
      <Button
        type="button"
        onClick={() => onChange('')}
        disabled={!selected.length}
      >
        پاک‌کردن انتخاب
      </Button>
    </details>
  );
}

export function AccountingAccountReviewFilters({
  book,
  periodId,
  activePeriodId,
  applied,
  onApply,
}: {
  book: AccountingSnapshotV1;
  periodId: string;
  activePeriodId?: string | undefined;
  applied: ReviewFilters;
  onApply: (filters: ReviewFilters, periodId: string) => void;
}) {
  const [form, setForm] = useState(applied);
  const [period, setPeriod] = useState(periodId);
  const selectedPeriod = book.periods.find((item) => item.id === period);
  const start = selectedPeriod?.startDate ?? '';
  const end = selectedPeriod?.endDate ?? '';
  const months = useMemo(() => fiscalReviewMonths(start, end), [start, end]);
  const change = (key: keyof ReviewFilters, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const input = (key: keyof ReviewFilters, label: string, numeric = false) => (
    <FormField label={label}>
      <Input
        aria-label={label}
        value={form[key]}
        dir="ltr"
        inputMode={numeric ? 'numeric' : 'decimal'}
        onChange={(event) =>
          change(
            key,
            numeric ? detailDigits(event.target.value) : event.target.value,
          )
        }
      />
    </FormField>
  );
  return (
    <details className="rounded-md border bg-muted/20" open>
      <summary className="cursor-pointer px-4 py-3 font-semibold">
        فیلتر اسناد
      </summary>
      <form
        className="space-y-3 px-4 pb-4"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(form, period);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FormField label="دوره مالی">
            <select
              aria-label="دوره مالی"
              className={fieldClass}
              disabled={!!activePeriodId}
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setForm((previous) => ({ ...previous, from: '', to: '' }));
              }}
            >
              <option value="">انتخاب دوره مالی</option>
              {book.periods.map((item) => (
                <option key={item.id} value={item.id}>
                  {book.configurations.find(
                    (config) => config.id === item.fiscalYearId,
                  )?.title ?? item.startDate}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="محدوده اسناد">
            <select
              aria-label="محدوده اسناد"
              className={fieldClass}
              value={form.mode}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  mode: event.target.value,
                  from: '',
                  to: '',
                  numberFrom: '',
                  numberTo: '',
                }))
              }
            >
              <option value="date">تاریخ</option>
              <option value="month">ماه</option>
              <option value="number">شماره سند</option>
            </select>
          </FormField>
          {form.mode === 'month' ? (
            <>
              <FormField label="از ماه">
                <select
                  aria-label="از ماه"
                  className={fieldClass}
                  value={form.from}
                  onChange={(event) => change('from', event.target.value)}
                >
                  <option value="">ابتدای دوره</option>
                  {months.map((month) => (
                    <option key={month.from} value={month.from}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="تا ماه">
                <select
                  aria-label="تا ماه"
                  className={fieldClass}
                  value={form.to}
                  onChange={(event) => change('to', event.target.value)}
                >
                  <option value="">پایان دوره</option>
                  {months.map((month) => (
                    <option key={month.to} value={month.to}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </>
          ) : form.mode === 'number' ? (
            <>
              {input('numberFrom', 'از شماره سند', true)}
              {input('numberTo', 'تا شماره سند', true)}
            </>
          ) : (
            <>
              <FormField label="از تاریخ">
                <DatePicker
                  aria-label="از تاریخ"
                  value={form.from}
                  onChange={(value) => change('from', value)}
                />
              </FormField>
              <FormField label="تا تاریخ">
                <DatePicker
                  aria-label="تا تاریخ"
                  value={form.to}
                  onChange={(value) => change('to', value)}
                />
              </FormField>
            </>
          )}
          <FormField label="نوع حساب">
            <select
              aria-label="نوع حساب"
              className={fieldClass}
              value={form.accountType}
              onChange={(event) => change('accountType', event.target.value)}
            >
              <option value="">همه</option>
              <option value="PERMANENT">دائم</option>
              <option value="TEMPORARY">موقت</option>
            </select>
          </FormField>
          <FormField label="نوع تفصیلی">
            <select
              aria-label="نوع تفصیلی"
              className={fieldClass}
              value={form.detailTypeId}
              onChange={(event) => change('detailTypeId', event.target.value)}
            >
              <option value="">همه</option>
              {book.configurations
                .filter((item) => item.kind === 'detail-types')
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
            </select>
          </FormField>
          {input('minAmount', 'حداقل مبلغ سند')}
          {input('maxAmount', 'حداکثر مبلغ سند')}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MultiFilter
            label="وضعیت سند"
            value={form.statuses}
            onChange={(value) => change('statuses', value)}
            options={Object.entries(reviewStatuses).map(([id, label]) => ({
              id,
              label,
            }))}
          />
          <MultiFilter
            label="نوع سند"
            value={form.typeIds}
            onChange={(value) => change('typeIds', value)}
            options={book.configurations
              .filter((item) => item.kind === 'voucher-types')
              .map((item) => ({ id: item.id, label: item.title }))}
          />
          <MultiFilter
            label="انتخاب حساب‌ها"
            value={form.accountIds}
            onChange={(value) => change('accountIds', value)}
            searchable
            options={book.accounts.map((item) => ({
              id: item.id,
              label: `${item.code} ـ ${item.title}`,
            }))}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ['hasBalance', 'حساب‌های دارای مانده'],
              ['traceableOnly', 'فقط معین‌های دارای ویژگی پیگیری'],
              ['currencyOnly', 'فقط مشاهده اسناد ارزی'],
            ] as const
          ).map(([key, label]) => (
            <label className="flex items-center gap-2" key={key}>
              <input
                type="checkbox"
                checked={form[key] === 'true'}
                onChange={(event) => change(key, String(event.target.checked))}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!period || !form.statuses}>
            اعمال فیلتر
          </Button>
          <Button
            type="button"
            onClick={() => {
              setForm(defaultReviewFilters);
              onApply(defaultReviewFilters, period);
            }}
          >
            فیلتر مجدد
          </Button>
        </div>
      </form>
    </details>
  );
}
