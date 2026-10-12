'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { AccountingButton as Button } from './accounting-operations';
import { apiRequest } from '../api/finance-inbox-api';
import type { CompletionReadiness } from '../accounting-completion-routes';

export function AccountingCompletionReadiness({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const [periodId, setPeriod] = useState(book.periods[0]?.id ?? '');
  const [requested, setRequested] = useState('');
  const current = requested === periodId && !!periodId;
  const query = useQuery({
    queryKey: ['accounting-completion-readiness', book.book.id, requested],
    enabled: current,
    retry: false,
    queryFn: () =>
      apiRequest<CompletionReadiness>(
        `/finance/accounting/books/${book.book.id}/completion/year-end/${requested}`,
      ),
  });
  const data =
    current && !query.isFetching && !query.isError ? query.data : undefined;
  return (
    <section className="space-y-4" dir="rtl">
      <h2 className="text-lg font-black">کنترل پیش‌نیازها</h2>
      <p role="status">
        این صفحه فقط پیش‌نیازها را بررسی می‌کند؛ صدور سند فعال نیست.
      </p>
      <SearchCombobox
        label="دوره مالی"
        value={periodId}
        onValueChange={setPeriod}
        options={book.periods.map((period) => ({
          value: period.id,
          label:
            book.configurations.find((row) => row.id === period.fiscalYearId)
              ?.title ?? period.startDate,
        }))}
      />
      <Button
        disabled={!periodId || query.isFetching}
        onClick={() =>
          current ? void query.refetch() : setRequested(periodId)
        }
      >
        کنترل پیش‌نیازها
      </Button>
      {current && query.isFetching && <p role="status">در حال بارگذاری…</p>}
      {current && query.isError && (
        <p role="alert">
          {query.error instanceof Error
            ? query.error.message
            : 'گزارش ناموفق بود.'}
        </p>
      )}
      {data && (
        <>
          <p>
            اسناد نهایی‌نشده: {data.unfinished} · <span>قطعی</span>:{' '}
            {data.posted} · {data.currency}
          </p>
          {!data.posted && (
            <p role="status">در دوره مالی جاری سند قطعی وجود ندارد</p>
          )}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {['کد', 'حساب', 'مانده', 'نوع', 'کنترل ماهیت'].map(
                    (title) => (
                      <th key={title} className="p-3 text-start">
                        {title}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.exceptions.map((row) => (
                  <tr key={row.accountId}>
                    {[
                      row.code,
                      row.title,
                      row.balance,
                      row.temporary ? 'موقت' : 'دائمی',
                      row.contrary ? 'بله' : 'خیر',
                    ].map((value, index) => (
                      <td key={index} className="border-t p-3">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
                {!data.exceptions.length && (
                  <tr>
                    <td colSpan={5} className="p-4">
                      سطری برای نمایش وجود ندارد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
