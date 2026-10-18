'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { apiRequest } from '../api/finance-inbox-api';
import styles from './accounting-navigation-workspace.module.css';

type Row = {
  key: string;
  dimensions: Record<string, string | null>;
  accountCode: string | null;
  accountTitle: string | null;
  opening: string;
  debit: string;
  credit: string;
  balance: string;
  sourceLineIds: string[];
};
type Dashboard = {
  currency: string;
  debit: string;
  credit: string;
  sourceCount: number;
  journalCount: number;
  unfinished: number;
  rows: Row[];
  accounts: Row[];
};
const amount = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
export function AccountingDashboard({ book }: { book: AccountingSnapshotV1 }) {
  const [periodId, setPeriod] = useState(book.periods[0]?.id ?? '');
  const query = useQuery({
    queryKey: ['accounting', 'dashboard', book.book.id, periodId],
    enabled: !!periodId,
    retry: false,
    queryFn: () =>
      apiRequest<Dashboard>(
        `/finance/accounting/books/${book.book.id}/completion/reports/dashboard?${new URLSearchParams({ periodId, axes: 'month' })}`,
      ),
  });
  const data = !query.isFetching && !query.isError ? query.data : undefined;
  const maximum = data
    ? Math.max(
        1,
        ...data.rows.flatMap((r) => [Number(r.debit), Number(r.credit)]),
      )
    : 1;
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-black">داشبورد حسابداری</h2>
      <div className={styles.kpiGrid}>
        {[
          ['گردش بدهکار', data?.debit],
          ['گردش بستانکار', data?.credit],
          ['اسناد قطعی', data ? String(data.journalCount) : undefined],
          ['اسناد نهایی‌نشده', data ? String(data.unfinished) : undefined],
        ].map(([label, value]) => (
          <article className={styles.kpiCard} key={label}>
            <div className={styles.kpiBody}>
              <h2>{label}</h2>
              <p>
                {value === undefined
                  ? query.isFetching
                    ? '…'
                    : '—'
                  : amount(value)}
              </p>
            </div>
          </article>
        ))}
      </div>
      <div className="rounded-xl border p-4">
        <SearchCombobox
          label="دوره مالی"
          value={periodId}
          onValueChange={setPeriod}
          options={book.periods.map((p) => ({
            value: p.id,
            label:
              book.configurations.find((c) => c.id === p.fiscalYearId)?.title ??
              p.startDate,
          }))}
        />
      </div>
      {query.isError && (
        <p role="alert">
          {query.error instanceof Error
            ? query.error.message
            : 'گزارش ناموفق بود.'}
        </p>
      )}
      {data && (
        <>
          <p>
            مبنای نمودارها اسناد قطعی دوره انتخاب‌شده است؛ واحد مبلغ:{' '}
            {data.currency}
          </p>
          <section className="rounded-xl border bg-background p-4">
            <h3 className="font-bold">گردش ماهانه</h3>
            {!data.rows.length ? (
              <p>در دوره مالی جاری سند قطعی وجود ندارد</p>
            ) : (
              <div className="mt-4 space-y-4">
                {data.rows.map((r) => (
                  <div key={r.key}>
                    <p>{r.dimensions.month}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-20 text-xs">بدهکار</span>
                      <div
                        className="h-4 rounded bg-blue-500"
                        style={{
                          width: `${(Number(r.debit) / maximum) * 70}%`,
                        }}
                      />
                      <span className="text-xs">{amount(r.debit)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-20 text-xs">بستانکار</span>
                      <div
                        className="h-4 rounded bg-teal-500"
                        style={{
                          width: `${(Number(r.credit) / maximum) * 70}%`,
                        }}
                      />
                      <span className="text-xs">{amount(r.credit)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="rounded-xl border bg-background p-4">
            <h3 className="font-bold">مانده حساب‌ها</h3>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      'کد',
                      'حساب',
                      'مانده اول دوره',
                      'بدهکار',
                      'بستانکار',
                      'مانده پایان',
                    ].map((h) => (
                      <th className="p-3 text-start" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((r) => (
                    <tr key={r.key}>
                      {[
                        r.accountCode,
                        r.accountTitle,
                        r.opening,
                        r.debit,
                        r.credit,
                        r.balance,
                      ].map((value, i) => (
                        <td key={i} className="border-t p-3">
                          {value ? amount(value) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
