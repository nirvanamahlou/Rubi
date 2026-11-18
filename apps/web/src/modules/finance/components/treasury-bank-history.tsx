'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { accountingApi } from '../api/accounting-api';
import { AccountingButton as Button } from './accounting-operations';

type Result = {
  rows: {
    id: string;
    date: string;
    action: string;
    isActive: boolean | null;
    balance: string | null;
  }[];
  hasNext: boolean;
};
const labels: Record<string, string> = {
  CREATE: 'ایجاد',
  UPDATE: 'ویرایش',
  DELETE: 'حذف',
};
const day = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran',
  dateStyle: 'short',
});
export function TreasuryBankHistory({ bookId }: { bookId: string }) {
  const [accountId, setAccount] = useState(''),
    [search, setSearch] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [page, setPage] = useState(1),
    [bankPage, setBankPage] = useState(1),
    [accountTitle, setAccountTitle] = useState('');
  const [filter, setFilter] = useState<{
    accountId: string;
    from: string;
    to: string;
  } | null>(null);
  const banks = useQuery({
    queryKey: [
      'treasury-instruments',
      bookId,
      'history-banks',
      search,
      bankPage,
    ],
    queryFn: () =>
      accountingApi.analytical<{
        rows: { id: string; title: string }[];
        hasNext: boolean;
      }>(bookId, 'treasury-instruments', {
        view: 'history-banks',
        search,
        page: String(bankPage),
      }),
  });
  const current =
    filter?.from === from &&
    filter?.to === to &&
    filter?.accountId === accountId;
  const report = useQuery({
    queryKey: ['treasury-instruments', bookId, 'history', filter, page],
    enabled: !!filter && current,
    queryFn: () =>
      accountingApi.analytical<Result>(bookId, 'treasury-instruments', {
        ...filter!,
        view: 'bank-history',
        page: String(page),
      }),
  });
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">تاریخچه حساب بانکی</h2>
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setFilter({ from, to, accountId });
          if (current) void report.refetch();
        }}
      >
        <FormField label="حساب بانکی" required>
          <SearchCombobox
            remote
            required
            label="حساب بانکی"
            value={accountId}
            selectedLabel={accountTitle}
            onSearchChange={(s) => {
              setBankPage(1);
              setSearch(s);
            }}
            loading={banks.isFetching}
            error={banks.error?.message}
            options={(banks.data?.rows ?? []).map((b) => ({
              value: b.id,
              label: b.title,
            }))}
            footer={
              <>
                <Button
                  type="button"
                  disabled={bankPage === 1}
                  onClick={() => setBankPage(bankPage - 1)}
                >
                  صفحه قبل
                </Button>
                <Button
                  type="button"
                  disabled={!banks.data?.hasNext}
                  onClick={() => setBankPage(bankPage + 1)}
                >
                  صفحه بعد
                </Button>
              </>
            }
            onValueChange={(id) => {
              setAccount(id);
              setAccountTitle(
                banks.data?.rows.find((b) => b.id === id)?.title ?? '',
              );
            }}
          />
        </FormField>
        <FormField label="از تاریخ" required>
          <DatePicker value={from} onChange={setFrom} required />
        </FormField>
        <FormField label="تا تاریخ" required>
          <DatePicker value={to} onChange={setTo} required />
        </FormField>
        <Button type="submit" disabled={!accountId || !from || !to}>
          مشاهده گزارش
        </Button>
      </form>
      {current && report.error && <p role="alert">{report.error.message}</p>}
      {current && report.data && (
        <>
          <table className="w-full">
            <thead>
              <tr>
                <th>تاریخ</th>
                <th>عملیات</th>
                <th>وضعیت</th>
                <th>میزان موجودی</th>
              </tr>
            </thead>
            <tbody>
              {report.data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{day.format(new Date(r.date))}</td>
                  <td>{labels[r.action]}</td>
                  <td>
                    {r.isActive === null
                      ? '—'
                      : r.isActive
                        ? 'فعال'
                        : 'غیرفعال'}
                  </td>
                  <td>{r.balance ?? 'موجودی ثبت نشده'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report.data.rows.length && <p>سطری برای نمایش وجود ندارد.</p>}
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            صفحه قبل
          </Button>
          <Button
            disabled={!report.data.hasNext}
            onClick={() => setPage(page + 1)}
          >
            صفحه بعد
          </Button>
        </>
      )}
    </section>
  );
}
