'use client';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import Link from '@/i18n/link';
import { apiRequest } from '../api/finance-inbox-api';
import {
  completionJournalHref,
  type CompletionLineReport,
} from '../accounting-completion-routes';
import {
  accountingViewRows,
  exportAccountingRows,
} from '../accounting-view-export';

const statusOptions = [
  { value: 'ALL', label: 'همه اسناد حذف‌نشده' },
  { value: 'POSTED', label: 'قطعی' },
  { value: 'DRAFT', label: 'ثبت موقت' },
  { value: 'MEMORANDUM', label: 'ثبت یادداشت' },
  { value: 'PENDING_APPROVAL', label: 'منتظر تأیید' },
  { value: 'APPROVED', label: 'بررسی شده' },
  { value: 'CANCELLED', label: 'حذف شده' },
];

export function AccountingCompletionReport({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const [periodId, setPeriod] = useState(book.periods[0]?.id ?? '');
  const [extra, setExtra] = useState<Record<string, string>>({
    status: 'POSTED',
    amountMode: 'BASE',
  });
  const change = (key: string, value: string) =>
    setExtra((current) => ({ ...current, [key]: value }));
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [accountId, setAccount] = useState('');
  const [request, setRequest] = useState<{
    filter: string;
    page: number;
  } | null>(null);
  const [exportError, setExportError] = useState('');
  const table = useRef<HTMLDivElement>(null);
  const filter = new URLSearchParams({
    periodId,
    from,
    to,
    accountId,
    ...Object.fromEntries(
      Object.entries(extra).filter(([, value]) => value !== ''),
    ),
  }).toString();
  const current = request?.filter === filter;
  const query = useQuery({
    queryKey: ['accounting-completion-lines', book.book.id, request],
    enabled: !!request && current,
    retry: false,
    queryFn: () =>
      apiRequest<CompletionLineReport>(
        `/finance/accounting/books/${book.book.id}/completion/journal-lines?${request!.filter}&page=${request!.page}`,
      ),
  });
  const report =
    current && !query.isFetching && !query.isError ? query.data : undefined;
  const exportPage = async () => {
    setExportError('');
    if (!table.current || !report) return;
    try {
      await exportAccountingRows(
        [
          ['اقلام سند', book.book.title],
          ['از تاریخ', report.from, 'تا تاریخ', report.to],
          [
            'وضعیت سند',
            statusOptions.find((option) => option.value === report.basis)
              ?.label ?? report.basis,
            'ارز',
            report.currency,
            'صفحه',
            String(report.page),
          ],
          ...accountingViewRows(table.current),
          ['جمع بدهکار', report.debit, 'جمع بستانکار', report.credit],
        ],
        'xlsx',
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'دریافت خروجی ناموفق بود.',
      );
    }
  };
  return (
    <section className="space-y-4" dir="rtl">
      <h2 className="text-lg font-black">اقلام سند</h2>
      <p className="text-sm text-muted-foreground">
        ارز پایه {book.book.baseCurrency}
      </p>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (request?.filter === filter && request.page === 1)
            void query.refetch();
          else setRequest({ filter, page: 1 });
        }}
      >
        <FormField label="دوره مالی">
          <SearchCombobox
            label="دوره مالی"
            value={periodId}
            onValueChange={setPeriod}
            options={book.periods.map((period) => ({
              value: period.id,
              label:
                book.configurations.find(
                  (row) => row.id === period.fiscalYearId,
                )?.title ?? period.startDate,
            }))}
          />
        </FormField>
        <FormField label="تا دوره مالی">
          <SearchCombobox
            label="تا دوره مالی"
            value={extra.toPeriodId ?? ''}
            onValueChange={(value) => change('toPeriodId', value)}
            options={book.periods.map((period) => ({
              value: period.id,
              label:
                book.configurations.find(
                  (row) => row.id === period.fiscalYearId,
                )?.title ?? period.startDate,
            }))}
          />
        </FormField>
        <FormField label="نوع سند">
          <SearchCombobox
            label="نوع سند"
            value={extra.typeId ?? ''}
            onValueChange={(value) => change('typeId', value)}
            options={book.configurations
              .filter((row) => row.kind === 'voucher-types')
              .map((row) => ({ value: row.id, label: row.title }))}
          />
        </FormField>
        <FormField label="وضعیت سند">
          <SearchCombobox
            label="وضعیت سند"
            value={extra.status ?? 'POSTED'}
            onValueChange={(value) => change('status', value)}
            options={statusOptions}
          />
        </FormField>
        {['fromNumber', 'toNumber'].map((key, index) => (
          <FormField
            key={key}
            label={index === 0 ? 'از شماره سند' : 'تا شماره سند'}
          >
            <Input
              aria-label={index === 0 ? 'از شماره سند' : 'تا شماره سند'}
              inputMode="numeric"
              value={extra[key] ?? ''}
              onChange={(event) => change(key, event.target.value)}
            />
          </FormField>
        ))}
        {[4, 5, 6].map((level) => (
          <FormField key={level} label={`سطح ${level}`}>
            <SearchCombobox
              label={`سطح ${level}`}
              value={extra[`detail${level}Id`] ?? ''}
              onValueChange={(value) => change(`detail${level}Id`, value)}
              options={book.details.map((detail) => ({
                value: detail.id,
                label: `${detail.code} — ${detail.title}`,
              }))}
            />
          </FormField>
        ))}
        <FormField label="فیلتر شرح">
          <SearchCombobox
            label="فیلتر شرح"
            value={extra.descriptionMode ?? 'contains'}
            onValueChange={(value) => change('descriptionMode', value)}
            options={[
              { value: 'contains', label: 'شامل' },
              { value: 'equals', label: 'برابر' },
              { value: 'startsWith', label: 'شروع با' },
              { value: 'endsWith', label: 'پایان با' },
            ]}
          />
        </FormField>
        <FormField label="شرح سند">
          <Input
            aria-label="شرح سند"
            value={extra.description ?? ''}
            onChange={(event) => change('description', event.target.value)}
          />
        </FormField>
        <FormField label="ارز">
          <Input
            aria-label="ارز"
            maxLength={3}
            dir="ltr"
            placeholder="USD"
            required={extra.amountMode === 'FOREIGN'}
            value={extra.currency ?? ''}
            onChange={(event) =>
              change('currency', event.target.value.toUpperCase())
            }
          />
        </FormField>
        <FormField label="مبنای مبلغ">
          <SearchCombobox
            label="مبنای مبلغ"
            value={extra.amountMode ?? 'BASE'}
            onValueChange={(value) => change('amountMode', value)}
            options={[
              { value: 'BASE', label: 'مبلغ به ارز عملیاتی' },
              { value: 'FOREIGN', label: 'مبلغ به ارز' },
            ]}
          />
        </FormField>
        <FormField label="حساب">
          <SearchCombobox
            label="حساب"
            value={accountId}
            onValueChange={setAccount}
            options={book.accounts
              .filter((account) => account.level === 'SUBSIDIARY')
              .map((account) => ({
                value: account.id,
                label: `${account.code} — ${account.title}`,
              }))}
          />
        </FormField>
        <FormField label="از تاریخ">
          <DatePicker aria-label="از تاریخ" value={from} onChange={setFrom} />
        </FormField>
        <FormField label="تا تاریخ">
          <DatePicker aria-label="تا تاریخ" value={to} onChange={setTo} />
        </FormField>
        <Button type="submit" disabled={!periodId || query.isFetching}>
          نمایش گزارش
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFrom('');
            setTo('');
            setAccount('');
            setExtra({ status: 'POSTED', amountMode: 'BASE' });
            setRequest(null);
          }}
        >
          پاک کردن فیلترها
        </Button>
      </form>
      {current && query.isFetching && <p role="status">در حال بارگذاری…</p>}
      {current && query.isError && (
        <p role="alert">
          {query.error instanceof Error
            ? query.error.message
            : 'گزارش ناموفق بود.'}
        </p>
      )}
      {exportError && <p role="alert">{exportError}</p>}
      {report && (
        <>
          <div ref={table} className="overflow-auto rounded-xl border">
            <p className="p-3">
              <span>اقلام سند</span> · {report.from} — {report.to} ·{' '}
              {report.currency} ·{' '}
              {
                statusOptions.find((option) => option.value === report.basis)
                  ?.label
              }{' '}
              · صفحه {report.page}
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {[
                    'شماره',
                    'تاریخ',
                    'ردیف',
                    'حساب',
                    'سطح 4',
                    'سطح 5',
                    'سطح 6',
                    'شرح',
                    'بدهکار',
                    'بستانکار',
                    'ارز',
                    'مبلغ ارزی',
                    'نرخ ارز',
                  ].map((title) => (
                    <th
                      key={title}
                      className="whitespace-nowrap border-b p-3 text-start"
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="p-3">
                      <Link
                        className="text-primary underline"
                        href={completionJournalHref(
                          book.book.id,
                          row.journalId,
                        )}
                      >
                        {row.number ?? '—'}
                      </Link>
                    </td>
                    {[
                      row.date,
                      row.position,
                      row.account,
                      row.detail4,
                      row.detail5,
                      row.detail6,
                      row.description,
                      row.debit,
                      row.credit,
                      row.currency,
                      row.foreignAmount,
                      row.rate,
                    ].map((value, index) => (
                      <td key={index} className="p-3">
                        {value ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {!report.rows.length && (
                  <tr>
                    <td colSpan={13} className="p-5 text-center">
                      سطری برای نمایش وجود ندارد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p>
            جمع بدهکار {report.debit} · جمع بستانکار {report.credit} ·{' '}
            {report.total} ردیف
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={report.page <= 1}
              onClick={() => setRequest({ filter, page: report.page - 1 })}
            >
              قبلی
            </Button>
            <span>صفحه {report.page}</span>
            <Button
              variant="outline"
              disabled={report.page * report.pageSize >= report.total}
              onClick={() => setRequest({ filter, page: report.page + 1 })}
            >
              بعدی
            </Button>
            <Button
              permission="finance.export"
              variant="outline"
              onClick={() => void exportPage()}
            >
              خروجی Excel
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            خروجی اطلاعات نمایش‌داده‌شده در این صفحه
          </p>
        </>
      )}
    </section>
  );
}
