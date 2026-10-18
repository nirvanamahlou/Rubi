'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingStatementV1,
} from '@nora/contracts';
import Link from '@/i18n/link';
import { Input } from '@/components/ui/form-controls';
import { AccountingButton as Button } from './accounting-operations';
import { accountingApi } from '../api/accounting-api';
import { journalDisplayTotals } from '../accounting-money';

const columns = [
  'شناسه',
  'عنوان تفصیلی',
  'شماره',
  'شماره براساس گیرنده',
  'تاریخ',
  'نوع',
  'وضعیت',
  'شرح',
  'بدهکار کل',
  'بستانکار کل',
];
const statuses = { CREATED: 'ثبت‌شده', SENT: 'ارسال‌شده', CANCELLED: 'لغوشده' };
export function AccountingStatementList({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const [search, setSearch] = useState(''),
    [applied, setApplied] = useState(''),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['accounting', 'statements-list', book.book.id, applied, page],
    queryFn: () =>
      accountingApi.analytical<{
        items: AccountingStatementV1[];
        total: number;
        pageSize: number;
      }>(book.book.id, 'document-statements', {
        page: String(page),
        ...(applied ? { search: applied } : {}),
      }),
    retry: false,
  });
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-black">فهرست اعلامیه بدهکار- بستانکار</h2>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={query.isFetching}
          onClick={() => {
            setApplied(search);
            setPage(1);
          }}
        >
          اجرای فیلتر
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSearch('');
            setApplied('');
            setPage(1);
          }}
        >
          نمایش بدون فیلتر
        </Button>
        <Button variant="outline" onClick={() => void query.refetch()}>
          بارگذاری مجدد
        </Button>
      </div>
      <div className="rounded-xl border p-3">
        <Input
          aria-label="جستجوی اعلامیه"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {query.isFetching && <p role="status">در حال بارگذاری…</p>}
      {query.isError && (
        <p role="alert">
          {query.error instanceof Error
            ? query.error.message
            : 'گزارش ناموفق بود.'}
        </p>
      )}
      {!query.isFetching && !query.isError && query.data && (
        <>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="p-3 text-start">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((r) => {
                  const totals = journalDisplayTotals(r.snapshot.rows);
                  return (
                    <tr key={r.id}>
                      {[
                        r.id,
                        r.snapshot.recipientTitle,
                        String(r.number),
                        String(r.recipientNumber),
                        r.documentDate,
                        r.snapshot.type === 'DEBIT'
                          ? 'بدهکار'
                          : r.snapshot.type === 'CREDIT'
                            ? 'بستانکار'
                            : 'هر دو',
                        statuses[r.status],
                        r.description,
                        totals.debit,
                        totals.credit,
                      ].map((cell, i) => (
                        <td className="border-t p-3" key={i}>
                          {i === 2 ? (
                            <Link
                              className="text-primary"
                              href={`/finance/accounting/general-ledger/documents/journals?${new URLSearchParams({ bookId: book.book.id, journalId: r.journalId, statementId: r.id })}`}
                            >
                              {cell}
                            </Link>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {!query.data.items.length && (
                  <tr>
                    <td colSpan={columns.length} className="p-4">
                      سطری برای نمایش وجود ندارد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p role="status">تعداد رکوردها: {query.data.total}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              قبلی
            </Button>
            <Button
              variant="outline"
              disabled={page * query.data.pageSize >= query.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
