'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingTaxpayerSeller,
} from '@nora/contracts';
import { useRouter } from 'next/navigation';
import { AccountingButton } from './accounting-operations';
import { Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { accountingTaxpayerApi } from '../api/accounting-taxpayer-api';
import {
  taxpayerPage,
  initialTaxpayerValues,
  visibleTaxpayerFields,
  changeTaxpayerValue,
  type TaxpayerValues,
} from '../accounting-taxpayer-model';
import type { TaxpayerPage } from '../accounting-taxpayer-catalog';
import { browserRandomUuid } from '@/lib/browser-random-uuid';

const dependencies: Record<string, string> = {
  settings:
    'ذخیره تنظیمات به محل امن نگهداری کلید و اتصال تأییدشده نیاز دارد. ورود رمز و کلید تا آماده‌شدن این اتصال غیرفعال است.',
  reconciliation:
    'مغایرت‌گیری به فایل کارپوشه و صورتحساب‌های ثبت‌شده نیاز دارد. مراحل بعدی و عملیات اصلاحی هنوز به سرویس متصل نیستند.',
  'cancellation-invoice':
    'ثبت ابطال به صورتحساب مرجع و مدل اختصاصی ابطال نیاز دارد؛ ارسال و تولید شماره مالیاتی فعال نیست.',
  'middleware-information': 'سرویس دریافت اطلاعات میدلور هنوز متصل نیست.',
  'operations/batch-schedules':
    'ذخیره و فعال‌سازی زمان‌بندی به سرویس عملیات و صف ارسال نیاز دارد؛ اجرای خودکار فعال نیست.',
};
const listForms: Record<string, string> = {
  settings: 'settings',
  cancellations: 'cancellation-invoice',
  'batch-schedules': 'operations/batch-schedules',
};

export function AccountingTaxpayerWorkspace({
  book,
  route,
}: {
  book: AccountingSnapshotV1;
  route: string;
}) {
  const page = taxpayerPage(route);
  return page ? (
    <TaxpayerLoader
      key={`${book.book.id}:${route}`}
      page={page}
      bookId={book.book.id}
    />
  ) : null;
}
function TaxpayerLoader({
  page,
  bookId,
}: {
  page: TaxpayerPage;
  bookId: string;
}) {
  const isSeller = page.route.endsWith('/seller-information');
  const query = useQuery({
    queryKey: ['accounting-taxpayer-seller', bookId],
    queryFn: () => accountingTaxpayerApi.seller(bookId),
    enabled: isSeller,
    retry: false,
  });
  if (isSeller && query.isPending)
    return <p role="status">در حال دریافت اطلاعات فروشنده…</p>;
  if (isSeller && query.isError)
    return (
      <div role="alert">
        <p>دریافت اطلاعات فروشنده ناموفق بود؛ ذخیره غیرفعال است.</p>
        <button type="button" onClick={() => void query.refetch()}>
          بارگذاری مجدد
        </button>
      </div>
    );
  return (
    <TaxpayerScreen
      key={`${page.route}:${query.data?.version ?? 0}`}
      page={page}
      bookId={bookId}
      seller={isSeller ? query.data : undefined}
    />
  );
}
function TaxpayerScreen({
  page,
  bookId,
  seller,
}: {
  page: TaxpayerPage;
  bookId: string;
  seller?: AccountingTaxpayerSeller | null | undefined;
}) {
  const router = useRouter(),
    client = useQueryClient();
  const [values, setValues] = useState<TaxpayerValues>(() => ({
    ...initialTaxpayerValues(page),
    ...seller?.values,
  }));
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('اطلاعات اصلی');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(false),
    [showFilters, setShowFilters] = useState(true);
  const requestKey = useRef<string | null>(null);
  const suffix = page.route.replace('taxpayer-system/', '');
  const isSeller = suffix === 'seller-information';
  const isList = page.kind === 'list';
  const dependency =
    page.blocker ||
    dependencies[suffix] ||
    (isList
      ? 'داده‌های این فهرست هنوز به سرویس صورتحساب متصل نیستند.'
      : page.kind === 'report'
        ? 'گزارش به اتصال داده‌های صورتحساب و پرداخت نیاز دارد.'
        : '');
  const fields = visibleTaxpayerFields(page, values);
  const change = (id: string, value: string | boolean) => {
    requestKey.current = null;
    setValues((v) => changeTaxpayerValue(page, v, id, value));
    setMessage('');
  };
  const save = async () => {
    if (!isSeller || busy) return;
    setBusy(true);
    setMessage('');
    try {
      requestKey.current ??= browserRandomUuid();
      const saved = await accountingTaxpayerApi.saveSeller(bookId, {
        key: requestKey.current,
        version: seller?.version ?? 0,
        values: {
          fvwMain_lkpPartyType_ComboBox_Input: String(
            values.fvwMain_lkpPartyType_ComboBox_Input,
          ) as AccountingTaxpayerSeller['values']['fvwMain_lkpPartyType_ComboBox_Input'],
          fvwMain_txtNationalID: String(values.fvwMain_txtNationalID ?? ''),
          fvwMain_txtEconomicID: String(values.fvwMain_txtEconomicID ?? ''),
          fvwMain_txtCivilParticipationID: String(
            values.fvwMain_txtCivilParticipationID ?? '',
          ),
        },
      });
      client.setQueryData(['accounting-taxpayer-seller', bookId], saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ذخیره ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  const reload = async () => {
    if (isSeller)
      await client.invalidateQueries({
        queryKey: ['accounting-taxpayer-seller', bookId],
      });
    else setMessage(dependency);
  };
  const canNew = isList && !!listForms[suffix.split('/').at(-1)!];
  const tabs =
    page.kind === 'info'
      ? [
          'اطلاعات اصلی',
          'تاریخچه تغییر وضعیت',
          'مکالمات',
          'یادداشت',
          'فرآیندهای مرتبط',
        ]
      : page.kind === 'form'
        ? ['اطلاعات اصلی', 'یادداشت']
        : [];
  const columns = page.columns.filter((c) => !hidden.includes(c));
  return (
    <section dir="rtl" className="space-y-4" aria-label={page.title}>
      <h2 className="text-lg font-black">{page.title}</h2>
      {dependency && (
        <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">
          {dependency}
        </p>
      )}
      {isSeller && (
        <p className="text-sm text-muted-foreground">
          اطلاعات فروشنده در همین دفتر ذخیره می‌شود. عنوان فروشنده به اطلاعات
          حقوقی شرکت متصل نشده است.
        </p>
      )}
      {page.kind !== 'blocked' && (
        <div
          role="toolbar"
          aria-label="عملیات فرم"
          className="flex flex-wrap gap-2 border-b pb-3"
        >
          {canNew && (
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={() =>
                router.push(
                  '/finance/accounting/taxpayer-system/' +
                    listForms[suffix.split('/').at(-1)!] +
                    '?' +
                    new URLSearchParams({ bookId }),
                )
              }
            >
              جدید
            </button>
          )}
          {page.kind === 'form' && (
            <AccountingButton
              permission="finance.account.manage"
              disabled={!isSeller || busy}
              onClick={() => void save()}
            >
              ذخیره
            </AccountingButton>
          )}
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={() => void reload()}
          >
            بارگذاری مجدد
          </button>
          {isList && (
            <>
              <button type="button" onClick={() => setShowFilters((v) => !v)}>
                فیلتر
              </button>
              <button type="button" onClick={() => setShowColumns((v) => !v)}>
                ستونها
              </button>
              <button type="button" disabled title={dependency}>
                ارسال به Excel
              </button>
              <button type="button" disabled title={dependency}>
                ویرایش
              </button>
              <button type="button" disabled title={dependency}>
                حذف
              </button>
            </>
          )}
          {page.kind === 'report' && (
            <button type="button" disabled title={dependency}>
              مشاهده گزارش
            </button>
          )}
        </div>
      )}
      {message && <p role="alert">{message}</p>}
      {!!tabs.length && (
        <div
          role="tablist"
          aria-label="بخش‌های فرم"
          className="flex gap-4 border-b"
        >
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="px-3 py-2"
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {tab !== 'اطلاعات اصلی' ? (
        <p role="status">این بخش هنوز به سرویس مربوط متصل نشده است.</p>
      ) : (
        <>
          {page.kind === 'wizard' && (
            <ol className="flex flex-wrap gap-3">
              {page.actions
                .filter(
                  (a) =>
                    a === 'ورود اطلاعات' ||
                    a.startsWith('عدم وجود') ||
                    a === 'مغایرت مبلغی' ||
                    a.startsWith('وضعیت صورتحساب') ||
                    a.startsWith('عملیات رد') ||
                    a.startsWith('صدور ابطال'),
                )
                .map((a, i) => (
                  <li key={a} className="rounded border p-2">
                    {i + 1}. {a}
                  </li>
                ))}
            </ol>
          )}
          {!!fields.length && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="grid items-start gap-4 md:grid-cols-3"
              autoComplete="off"
            >
              {fields.map((f) => {
                const id = `taxpayer-${f.id}`;
                const disabled =
                  busy ||
                  f.disabled ||
                  f.sensitive ||
                  (f.type === 'select' && !f.options?.length);
                return (
                  <div
                    key={f.id}
                    className={f.type === 'textarea' ? 'md:col-span-2' : ''}
                  >
                    <label htmlFor={id} className="mb-1 block text-sm">
                      {f.label}
                      {f.required ? ' *' : ''}
                    </label>
                    {f.type === 'select' ? (
                      <select
                        id={id}
                        className="w-full rounded border bg-background p-2"
                        value={String(values[f.id] ?? '')}
                        disabled={disabled}
                        required={f.required}
                        onChange={(e) => change(f.id, e.target.value)}
                      >
                        <option value="" />
                        {f.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'checkbox' || f.type === 'radio' ? (
                      <input
                        id={id}
                        type={f.type}
                        name={f.type === 'radio' ? 'report-mode' : f.id}
                        checked={!!values[f.id]}
                        disabled={disabled}
                        onChange={(e) => change(f.id, e.target.checked)}
                      />
                    ) : f.type === 'date' ? (
                      <DatePicker
                        id={id}
                        value={String(values[f.id] ?? '')}
                        onChange={(v) => change(f.id, v)}
                        disabled={disabled || f.readOnly}
                      />
                    ) : f.type === 'textarea' ? (
                      <textarea
                        id={id}
                        rows={4}
                        className="w-full rounded border bg-background p-2"
                        value={String(values[f.id] ?? '')}
                        readOnly={f.readOnly}
                        disabled={disabled}
                        onChange={(e) => change(f.id, e.target.value)}
                      />
                    ) : (
                      <Input
                        id={id}
                        type={
                          f.sensitive
                            ? 'password'
                            : f.type === 'time'
                              ? 'time'
                              : 'text'
                        }
                        value={String(values[f.id] ?? '')}
                        readOnly={f.readOnly}
                        disabled={disabled}
                        required={f.required}
                        onChange={(e) => change(f.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </form>
          )}
          {page.kind === 'wizard' && (
            <button type="button" disabled title={dependency}>
              شروع مغایرت گیری
            </button>
          )}
          {!!page.columns.length && (
            <>
              {showColumns && (
                <fieldset className="flex flex-wrap gap-3">
                  <legend>ستونها</legend>
                  {page.columns.map((c) => (
                    <label key={c}>
                      <input
                        type="checkbox"
                        checked={!hidden.includes(c)}
                        onChange={(e) =>
                          setHidden((v) =>
                            e.target.checked
                              ? v.filter((x) => x !== c)
                              : [...v, c],
                          )
                        }
                      />
                      {c}
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="overflow-x-auto rounded border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th
                          key={c}
                          className="whitespace-nowrap border-b p-3 text-right"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                    {showFilters && isList && (
                      <tr>
                        {columns.map((c) => (
                          <th key={c} className="p-2">
                            <Input
                              aria-label={`فیلتر ${c}`}
                              value={filters[c] ?? ''}
                              onChange={(e) =>
                                setFilters((v) => ({
                                  ...v,
                                  [c]: e.target.value,
                                }))
                              }
                            />
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        colSpan={Math.max(1, columns.length)}
                        className="p-5 text-center"
                      >
                        داده دریافت نشده است.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
