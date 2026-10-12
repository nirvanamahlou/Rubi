'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingTaxField,
  AccountingTaxRecord,
  AccountingTaxValues,
} from '@nora/contracts';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { AccountingButton as Button } from './accounting-operations';
import { parseSetupNotes, type SetupNote } from './accounting-setup-notes';
import { AccountingTaxNotes } from './accounting-tax-notes';
import { accountingTaxApi } from '../api/accounting-tax-api';
import { exportAccountingView } from '../accounting-view-export';
import {
  accountingTaxRoute,
  changeTaxValue,
  emptyTaxValues,
  taxListKeys,
} from '../accounting-tax-model';

const dependencies: Record<string, string> = {
  identity:
    'انتخاب شرکت، نشانی و کدهای اداره مالیاتی هنوز به اطلاعات مرجع متصل نشده است.',
  general:
    'ثبت و صدور اظهارنامه به اتصال اقلام مالی، مدل اظهارنامه و گردش تأیید وابسته است.',
  pollution:
    'ثبت و صدور اظهارنامه آلایندگی به اتصال اقلام مالی و مدل اظهارنامه وابسته است.',
  mapping:
    'نگاشت به اتصال فهرست مناطق جغرافیایی و ارزهای اداره مالیات وابسته است.',
  'return-lines':
    'گزارش به اطلاعات ذخیره‌شدهٔ اظهارنامه و اقلام مالی نیاز دارد.',
  parties:
    'فهرست طرف معاملات مالیاتی به قرارداد اطلاعات اشخاص و معاملات وابسته است.',
  history: 'تاریخچه پس از اتصال اقلام تجمیعی و رویدادهای تغییر قابل ارائه است.',
};

export function AccountingTaxWorkspace({
  book,
  route,
}: {
  book: AccountingSnapshotV1;
  route: string;
}) {
  const match = accountingTaxRoute(route);
  return match ? (
    <TaxWorkspace key={`${book.book.id}:${route}`} book={book} match={match} />
  ) : null;
}

function TaxWorkspace({
  book,
  match,
}: {
  book: AccountingSnapshotV1;
  match: NonNullable<ReturnType<typeof accountingTaxRoute>>;
}) {
  const { form, list, listRoute } = match;
  const router = useRouter(),
    client = useQueryClient();
  const [values, setValues] = useState<AccountingTaxValues>(() =>
    emptyTaxValues(form),
  );
  const [notes, setNotes] = useState<SetupNote[]>([]);
  const [record, setRecord] = useState<AccountingTaxRecord | null>(null);
  const [editing, setEditing] = useState(!list);
  const [tab, setTab] = useState<'main' | 'notes'>('main');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const requestKey = useRef<string | null>(null);
  const listElement = useRef<HTMLDivElement>(null);
  const reload = async () => {
    const result = await query.refetch();
    if (editing && record && result.data) {
      const fresh = result.data.items.find((item) => item.id === record.id);
      if (fresh) open(fresh);
      else setError('رکورد دیگر در فهرست موجود نیست.');
    }
  };
  const remove = async (after: 'new' | 'close') => {
    if (!record || busy || !window.confirm('رکورد حذف شود؟')) return;
    setBusy(true);
    setError('');
    try {
      await accountingTaxApi.remove(
        book.book.id,
        form.key,
        record.id,
        record.version,
        crypto.randomUUID(),
      );
      await client.invalidateQueries({ queryKey });
      reset();
      if (after === 'close') setEditing(false);
      setMessage('حذف شد.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'حذف انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  const queryKey = ['accounting-tax', book.book.id, form.key];
  const query = useQuery({
    queryKey,
    queryFn: () => accountingTaxApi.list(book.book.id, form.key),
    enabled: form.writable,
  });
  const patterns = useQuery({
    queryKey: ['accounting-tax', book.book.id, 'aggregation'],
    queryFn: () => accountingTaxApi.list(book.book.id, 'aggregation'),
    enabled: form.key === 'periods',
  });
  const periods = useQuery({
    queryKey: ['accounting-tax', book.book.id, 'periods'],
    queryFn: () => accountingTaxApi.list(book.book.id, 'periods'),
    enabled: ['general', 'pollution', 'return-lines'].includes(form.key),
  });
  const reset = () => {
    setRecord(null);
    setValues(emptyTaxValues(form));
    setNotes([]);
    setEditing(true);
    setMessage('');
    setError('');
    requestKey.current = null;
  };
  const open = (item: AccountingTaxRecord) => {
    setRecord(item);
    setValues(item.values);
    setNotes(parseSetupNotes(item.values.notes));
    setEditing(true);
    setMessage('');
    setError('');
    requestKey.current = null;
  };
  const change = (key: string, value: string | boolean | string[]) => {
    setValues((old) => changeTaxValue(form, old, key, value));
    requestKey.current = null;
    setMessage('');
  };
  const save = async (after: 'stay' | 'new' | 'close') => {
    if (busy || !form.writable) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      requestKey.current ??= crypto.randomUUID();
      const writable = Object.fromEntries(
        form.fields
          .filter((field) => !field.readOnly)
          .map((field) => [field.key, values[field.key] ?? '']),
      );
      const saved = await accountingTaxApi.save(book.book.id, form.key, {
        ...(record ? { id: record.id, version: record.version } : {}),
        key: requestKey.current,
        values: writable,
        notes,
      });
      await client.invalidateQueries({ queryKey });
      open(saved);
      setMessage('ذخیره شد.');
      if (after === 'new') reset();
      if (after === 'close') setEditing(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  };
  const control = (field: AccountingTaxField) => {
    const disabled =
      busy ||
      field.disabled ||
      Boolean(
        field.dependsOn && values[field.dependsOn] !== field.dependsValue,
      );
    const value = values[field.key];
    if (field.kind === 'check')
      return (
        <label key={field.key} className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(event) => change(field.key, event.target.checked)}
          />
          {field.label}
        </label>
      );
    let input;
    if (field.kind === 'select' || field.kind === 'lookup') {
      const options =
        field.kind === 'select'
          ? (field.options ?? []).map((label) => ({ id: label, title: label }))
          : field.lookup === 'aggregation'
            ? (patterns.data?.items ?? [])
            : field.lookup === 'periods'
              ? (periods.data?.items ?? [])
              : [];
      input = (
        <select
          id={`tax-${field.key}`}
          className="h-9 w-full rounded border bg-background px-2"
          value={typeof value === 'string' ? value : ''}
          disabled={disabled || !options.length}
          required={field.required}
          onChange={(event) => change(field.key, event.target.value)}
        >
          <option value="" />
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      );
    } else if (field.kind === 'multi')
      input = (
        <div className="max-h-44 overflow-auto rounded border p-2">
          {field.options?.map((option) => (
            <label className="flex gap-2 py-1" key={option}>
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(option)}
                onChange={(event) =>
                  change(
                    field.key,
                    event.target.checked
                      ? [...(Array.isArray(value) ? value : []), option]
                      : (Array.isArray(value) ? value : []).filter(
                          (item) => item !== option,
                        ),
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
      );
    else if (field.kind === 'date')
      input = (
        <DatePicker
          id={`tax-${field.key}`}
          value={String(value ?? '')}
          onChange={(date) => change(field.key, date)}
          disabled={disabled || field.readOnly}
        />
      );
    else
      input = (
        <Input
          id={`tax-${field.key}`}
          value={String(value ?? '')}
          inputMode={field.kind === 'decimal' ? 'decimal' : 'text'}
          readOnly={field.readOnly}
          disabled={disabled}
          required={field.required}
          onChange={(event) => change(field.key, event.target.value)}
        />
      );
    return (
      <div key={field.key} className="space-y-1">
        <label htmlFor={`tax-${field.key}`} className="text-xs">
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        {input}
      </div>
    );
  };
  const groups =
    form.key === 'aggregation'
      ? [
          {
            title: 'تعریف روش تجمیع اطلاعات',
            fields: form.fields.filter(
              (field) =>
                !field.key.startsWith('Buy_') && !field.key.startsWith('Sale_'),
            ),
          },
          {
            title: 'خرید',
            fields: form.fields.filter((field) => field.key.startsWith('Buy_')),
          },
          {
            title: 'فروش',
            fields: form.fields.filter((field) =>
              field.key.startsWith('Sale_'),
            ),
          },
        ]
      : form.key === 'thresholds'
        ? [
            { title: 'اطلاعات اصلی', fields: form.fields.slice(0, 3) },
            { title: 'خرید و فروش فصلی', fields: form.fields.slice(3) },
          ]
        : ['general', 'pollution'].includes(form.key)
          ? [
              {
                title: 'اطلاعات پایه اظهارنامه',
                fields: form.fields.slice(0, 6),
              },
              {
                title: 'اطلاعات پایه',
                fields: form.fields.slice(6, form.key === 'general' ? 17 : 16),
              },
            ]
          : [{ title: 'اطلاعات اصلی', fields: form.fields }];
  const items = (query.data?.items ?? []).filter(
    (item) =>
      !filter ||
      Object.values(item.values).some((value) =>
        String(value).includes(filter),
      ),
  );
  return (
    <section
      dir="rtl"
      className="space-y-4 rounded-lg border bg-card p-4"
      aria-label={form.title}
    >
      <h2 className="font-semibold">{form.title}</h2>
      {dependencies[form.key] && (
        <p
          role="status"
          className="rounded border border-amber-300 p-3 text-sm"
        >
          {dependencies[form.key]}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {query.error && (
        <p role="alert">
          {query.error instanceof Error
            ? query.error.message
            : 'بارگذاری انجام نشد.'}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {query.data?.truncated && (
        <p role="status">
          فقط ۱۰۰۰ رکورد اول نمایش داده شده است؛ فیلتر و خروجی محدود به همین
          رکوردهاست.
        </p>
      )}
      <div
        role="toolbar"
        aria-label="عملیات مالیاتی"
        className="flex flex-wrap gap-2 border-b pb-3"
      >
        {form.writable && (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={reset}
            >
              جدید
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || query.isPending}
              onClick={() => {
                setEditing(false);
                void query.refetch();
              }}
            >
              باز کردن
            </Button>
            {editing && (
              <>
                <Button
                  variant="outline"
                  permission="finance.account.manage"
                  disabled={busy || !record}
                  onClick={() => void remove('close')}
                >
                  حذف و بستن
                </Button>
                <Button
                  variant="outline"
                  permission="finance.account.manage"
                  disabled={busy || !record}
                  onClick={() => void remove('new')}
                >
                  حذف و جدید
                </Button>
                <Button
                  permission="finance.account.manage"
                  disabled={busy}
                  onClick={() => void save('stay')}
                >
                  ذخیره
                </Button>
                <Button
                  permission="finance.account.manage"
                  disabled={busy}
                  onClick={() => void save('new')}
                >
                  ذخیره و جدید
                </Button>
                <Button
                  permission="finance.account.manage"
                  disabled={busy}
                  onClick={() => void save('close')}
                >
                  ذخیره و بستن
                </Button>
              </>
            )}
          </>
        )}
        {form.writable && (
          <Button
            variant="outline"
            disabled={busy || query.isFetching}
            onClick={() => void reload()}
          >
            بارگذاری مجدد
          </Button>
        )}
        {form.writable && !editing && (
          <Button
            variant="outline"
            permission="finance.export"
            disabled={!items.length}
            onClick={() => {
              if (listElement.current)
                void exportAccountingView(listElement.current, 'xlsx').catch(
                  (failure: unknown) =>
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : 'خروجی انجام نشد.',
                    ),
                );
            }}
          >
            ارسال به Excel
          </Button>
        )}
        {listRoute && editing && (
          <Button
            variant="outline"
            onClick={() =>
              router.push(
                `/finance/accounting/${listRoute}?bookId=${book.book.id}`,
              )
            }
          >
            فهرست
          </Button>
        )}
      </div>
      {!editing ? (
        <>
          <Input
            aria-label="فیلتر"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div ref={listElement} className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {form.listColumns.map((label) => (
                    <th className="border p-2" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} onDoubleClick={() => open(item)}>
                    {(taxListKeys[form.key] ?? []).map((key, index) => (
                      <td key={key} className="border p-2">
                        {index === 0 ? (
                          <button
                            type="button"
                            className="underline"
                            onClick={() => open(item)}
                          >
                            {String(item.values[key] ?? '') || '—'}
                          </button>
                        ) : key === '$active' ? (
                          'فعال'
                        ) : (
                          String(item.values[key] ?? '')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td
                      colSpan={Math.max(1, form.listColumns.length)}
                      className="p-6 text-center text-muted-foreground"
                    >
                      {query.isFetching
                        ? 'در حال بارگذاری…'
                        : form.writable
                          ? 'سطری برای نمایش وجود ندارد.'
                          : 'داده‌های این بخش هنوز متصل نشده‌اند.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {form.hasNotes && (
            <div role="tablist" className="flex gap-3 border-b">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'main'}
                className="p-2"
                onClick={() => setTab('main')}
              >
                اطلاعات اصلی
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'notes'}
                className="p-2"
                onClick={() => setTab('notes')}
              >
                یادداشت
              </button>
            </div>
          )}
          {tab === 'notes' ? (
            <AccountingTaxNotes
              notes={notes}
              onChange={(next) => {
                setNotes(next);
                requestKey.current = null;
              }}
            />
          ) : (
            <>
              {groups.map((group) => (
                <fieldset key={group.title} className="rounded border p-3">
                  <legend className="px-2 text-sm">{group.title}</legend>
                  <div
                    className={`grid gap-4 ${form.key === 'aggregation' ? 'grid-cols-1' : 'md:grid-cols-3'}`}
                  >
                    {group.fields.map(control)}
                  </div>
                </fieldset>
              ))}
              {form.tables.map((table, index) => (
                <fieldset
                  key={table.title}
                  className="overflow-auto rounded border p-3"
                >
                  <legend>{table.title}</legend>
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {table.columns.map((column) => (
                          <th className="border p-2" key={column}>
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          className="p-4 text-center text-muted-foreground"
                          colSpan={table.columns.length}
                        >
                          داده‌های این بخش هنوز متصل نشده‌اند.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {form.key === 'general' && (
                    <div className="grid gap-4 pt-3 md:grid-cols-3">
                      {form.fields
                        .slice([17, 23, 29, 33][index], [23, 29, 33, 37][index])
                        .map(control)}
                    </div>
                  )}
                </fieldset>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
