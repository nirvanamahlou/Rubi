'use client';
import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import Link from '@/i18n/link';
import { apiRequest } from '../api/finance-inbox-api';
import {
  completionJournalHref,
  type CompletionLineReport,
} from '../accounting-completion-routes';
import { exportAccountingView } from '../accounting-view-export';

export function AccountingCompletionReport({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const [periodId, setPeriod] = useState(book.periods[0]?.id ?? '');
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
      await exportAccountingView(table.current, 'xlsx');
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
        مبنای گزارش: اسناد قطعی · ارز پایه {book.book.baseCurrency}
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
              {report.currency} · صفحه {report.page}
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
