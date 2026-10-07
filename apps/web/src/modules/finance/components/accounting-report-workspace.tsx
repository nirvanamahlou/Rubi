'use client';
import { useState } from 'react';
import type {
  AccountingSnapshotV1,
  AccountingReportV1,
  AccountingTurnoverV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { localizedFetch } from '@/i18n/localized-fetch';
import { apiRequest } from '../api/finance-inbox-api';
import { accountingApi } from '../api/accounting-api';
import Link from '@/i18n/link';
export function AccountingReportWorkspace({
  book,
  turnoverMode = false,
}: {
  book: AccountingSnapshotV1;
  turnoverMode?: boolean;
}) {
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [periodId, setPeriodId] = useState(
      book.periods.find(
        (p) =>
          p.startDate <= new Date().toISOString().slice(0, 10) &&
          p.endDate >= new Date().toISOString().slice(0, 10),
      )?.id ??
        book.periods[0]?.id ??
        '',
    ),
    [level, setLevel] = useState('SUBSIDIARY'),
    [accountId, setAccountId] = useState('');
  const [report, setReport] = useState<AccountingReportV1 | null>(null),
    [turnover, setTurnover] = useState<AccountingTurnoverV1 | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [reportFilter, setReportFilter] = useState('');
  const [turnoverFilter, setTurnoverFilter] = useState('');
  const filter = JSON.stringify([book.book.id, from, to, periodId, level]);
  const currentReport = reportFilter === filter ? report : null;
  const currentTurnover =
    turnoverFilter === JSON.stringify([filter, accountId]) ? turnover : null;
  const query = () => ({ from, to, periodId, level });
  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      setReport(await accountingApi.report(book.book.id, query()));
      setReportFilter(filter);
      setTurnover(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'گزارش ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  const browse = async (id: string, page = 1) => {
    setBusy(true);
    setError('');
    setAccountId(id);
    try {
      setTurnover(
        await apiRequest<AccountingTurnoverV1>(
          `/finance/accounting/books/${book.book.id}/reports/turnover?${new URLSearchParams({ accountId: id, periodId, from, to, page: String(page) })}`,
        ),
      );
      setTurnoverFilter(JSON.stringify([filter, id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'گزارش ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    setBusy(true);
    setError('');
    try {
      let response = await localizedFetch(
        `${getPublicApiBaseUrl()}/finance/accounting/books/${book.book.id}/reports/trial-balance/export?${new URLSearchParams(query())}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (
        response.status === 401 &&
        (await refreshAuthenticatedSession(getPublicApiBaseUrl()!))
      )
        response = await localizedFetch(
          `${getPublicApiBaseUrl()}/finance/accounting/books/${book.book.id}/reports/trial-balance/export?${new URLSearchParams(query())}`,
          { credentials: 'include', cache: 'no-store' },
        );
      if (!response.ok) throw new Error('دریافت خروجی گزارش ناموفق بود.');
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement('a');
      a.href = url;
      a.download = 'accounting-trial-balance.xlsx';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت خروجی ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-black">
        {turnoverMode ? 'گردش حساب' : 'تراز حساب‌ها'}
      </h2>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (turnoverMode) void browse(accountId);
          else void generate();
        }}
      >
        <FormField label="از تاریخ">
          <DatePicker aria-label="از تاریخ" value={from} onChange={setFrom} />
        </FormField>
        <FormField label="تا تاریخ">
          <DatePicker aria-label="تا تاریخ" value={to} onChange={setTo} />
        </FormField>
        <FormField label="دوره مالی">
          <SearchCombobox
            label="دوره مالی"
            value={periodId}
            onValueChange={setPeriodId}
            options={book.periods.map((p) => ({
              value: p.id,
              label:
                book.configurations.find((c) => c.id === p.fiscalYearId)
                  ?.title ?? p.startDate,
            }))}
          />
        </FormField>
        {turnoverMode ? (
          <FormField label="حساب">
            <SearchCombobox
              label="حساب"
              value={accountId}
              onValueChange={setAccountId}
              options={book.accounts
                .filter((a) => a.level === 'SUBSIDIARY')
                .map((a) => ({ value: a.id, label: `${a.code} — ${a.title}` }))}
            />
          </FormField>
        ) : (
          <>
            <FormField label="سطح گزارش">
              <SearchCombobox
                label="سطح گزارش"
                value={level}
                onValueChange={setLevel}
                options={[
                  { value: 'GROUP', label: 'گروه' },
                  { value: 'GENERAL', label: 'کل' },
                  { value: 'SUBSIDIARY', label: 'معین' },
                ]}
              />
            </FormField>
          </>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button disabled={busy} type="submit">
            نمایش گزارش
          </Button>
          {currentReport ? (
            <Button
              disabled={busy}
              permission="finance.export"
              variant="outline"
              type="button"
              onClick={() => void download()}
            >
              خروجی Excel
            </Button>
          ) : null}
        </div>
      </form>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {currentReport && !turnoverMode ? (
        <>
          <p className="text-sm text-muted-foreground">
            مبنای گزارش: اسناد قطعی · ارز پایه {book.book.baseCurrency}
          </p>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {[
                    'کد',
                    'حساب',
                    'مانده اول دوره',
                    'بدهکار',
                    'بستانکار',
                    'مانده پایان',
                  ].map((t) => (
                    <th key={t} className="p-3 text-start">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentReport.rows.map((r) => (
                  <tr key={r.accountId} className="border-t">
                    <td className="p-3">{r.code}</td>
                    <td className="p-3">
                      {level === 'SUBSIDIARY' ? (
                        <Button
                          variant="ghost"
                          onClick={() => void browse(r.accountId)}
                        >
                          {r.title}
                        </Button>
                      ) : (
                        r.title
                      )}
                    </td>
                    {[r.opening, r.debit, r.credit, r.balance].map(
                      (value, i) => (
                        <td key={i} className="p-3" dir="ltr">
                          {value}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-bold">
            جمع بدهکار {currentReport.debit} · جمع بستانکار{' '}
            {currentReport.credit}
          </p>
        </>
      ) : null}
      {currentTurnover ? (
        <>
          <h3 className="font-bold">
            {book.accounts.find((a) => a.id === accountId)?.title} · مانده
            ابتدای بازه {currentTurnover.opening}
          </h3>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {['شماره', 'تاریخ', 'شرح', 'بدهکار', 'بستانکار', 'مانده'].map(
                    (t) => (
                      <th className="p-3 text-start" key={t}>
                        {t}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {currentTurnover.rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">
                      <Link
                        href={`/finance/accounting/general-ledger/documents/list?bookId=${book.book.id}&journalId=${r.journalId}`}
                        className="text-primary"
                      >
                        {r.number}
                      </Link>
                    </td>
                    {[r.date, r.description, r.debit, r.credit, r.balance].map(
                      (v, n) => (
                        <td className="p-3" key={n}>
                          {v}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={busy || currentTurnover.page === 1}
              onClick={() => void browse(accountId, currentTurnover.page - 1)}
            >
              قبلی
            </Button>
            <span>
              صفحه {currentTurnover.page} · {currentTurnover.total} ردیف · مانده
              پایان {currentTurnover.closing}
            </span>
            <Button
              variant="outline"
              disabled={
                busy || currentTurnover.page * 30 >= currentTurnover.total
              }
              onClick={() => void browse(accountId, currentTurnover.page + 1)}
            >
              بعدی
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
