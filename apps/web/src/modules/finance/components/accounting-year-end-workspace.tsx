'use client';
import { useState } from 'react';
import type {
  AccountingSnapshotV1,
  AccountingCommandV1,
  AccountingJournalV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { DatePicker } from '@/components/ui/date-picker';
import Link from '@/i18n/link';
type Preflight = {
  unfinished: number;
  balances: { accountId: string; balance: string; permanent: boolean }[];
};
export function AccountingYearEndWorkspace({
  book,
  run,
  busy,
  mode,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  mode: 'closing' | 'opening';
  run: <T = unknown>(
    action: string,
    payload: AccountingCommandV1['payload'],
    version?: number,
  ) => Promise<T | undefined>;
}) {
  const [periodId, setPeriodId] = useState(''),
    [nextPeriodId, setNextPeriodId] = useState(''),
    [retainedAccountId, setRetainedAccountId] = useState(''),
    [typeId, setTypeId] = useState(''),
    [date, setDate] = useState(''),
    [preflight, setPreflight] = useState<Preflight | null>(null),
    [result, setResult] = useState<AccountingJournalV1 | null>(null);
  const period = book.periods.find((p) => p.id === periodId);
  const preview = async () => {
    const r = await run<Preflight>('year-end-preview', { periodId });
    if (r) setPreflight(r);
  };
  const generate = async (opening: boolean) => {
    const r = await run<AccountingJournalV1>(
      opening ? 'year-end-opening' : 'year-end-closing',
      {
        periodId,
        nextPeriodId,
        retainedAccountId,
        typeId,
        documentDate: date,
        fxCarryPolicy: 'HISTORICAL_LOTS',
      },
    );
    if (r) setResult(r);
  };
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-black">
        {mode === 'opening' ? 'صدور سند افتتاحیه' : 'صدور سند بستن حساب‌ها'}
      </h2>
      <p className="text-sm text-muted-foreground">
        افتتاحیه و بستن ارزی، مقادیر و ارزش تاریخی هر نرخ مصوب را از اسناد قطعی
        مبدأ حفظ می‌کند؛ تغییر نرخ با تسعیر جداگانه انجام می‌شود.
      </p>
      <ol className="grid gap-3 text-sm sm:grid-cols-4">
        {[
          '۱. کنترل اسناد و مانده‌ها',
          mode === 'opening'
            ? '۲. کنترل بسته‌بودن دوره مبدأ'
            : '۲. بستن حساب‌های موقت',
          mode === 'opening'
            ? '۳. انتقال مانده‌های دائمی'
            : '۳. بستن دوره مبدأ',
          mode === 'opening'
            ? '۴. ایجاد پیش‌نویس افتتاحیه'
            : '۴. تأیید و ثبت از فهرست اسناد',
        ].map((t) => (
          <li key={t} className="rounded-xl border bg-muted/30 p-3">
            {t}
          </li>
        ))}
      </ol>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="دوره مبدأ">
          <SearchCombobox
            label="دوره مبدأ"
            value={periodId}
            onValueChange={(id) => {
              setPeriodId(id);
              setPreflight(null);
              setResult(null);
            }}
            options={book.periods.map((p) => ({
              value: p.id,
              label: `${book.configurations.find((c) => c.id === p.fiscalYearId)?.title ?? ''} · ${p.status === 'OPEN' ? 'باز' : 'بسته'}`,
            }))}
          />
        </FormField>
        <FormField label="دوره مقصد افتتاحیه">
          <SearchCombobox
            label="دوره مقصد"
            value={nextPeriodId}
            onValueChange={setNextPeriodId}
            options={book.periods
              .filter((p) => p.status === 'OPEN' && p.id !== periodId)
              .map((p) => ({
                value: p.id,
                label:
                  book.configurations.find((c) => c.id === p.fiscalYearId)
                    ?.title ?? p.startDate,
              }))}
          />
        </FormField>
        <FormField label="حساب دائمی سود و زیان">
          <SearchCombobox
            label="حساب سود و زیان"
            value={retainedAccountId}
            onValueChange={setRetainedAccountId}
            options={book.accounts
              .filter(
                (a) => a.active && a.permanent && a.level === 'SUBSIDIARY',
              )
              .map((a) => ({ value: a.id, label: `${a.code} — ${a.title}` }))}
          />
        </FormField>
        <FormField label="نوع سند">
          <SearchCombobox
            label="نوع سند"
            value={typeId}
            onValueChange={setTypeId}
            options={book.configurations
              .filter((c) => c.kind === 'voucher-types' && c.active)
              .map((c) => ({ value: c.id, label: c.title }))}
          />
        </FormField>
        <FormField label="تاریخ سند بستن یا افتتاحیه">
          <DatePicker
            aria-label="تاریخ سند بستن یا افتتاحیه"
            value={date}
            onChange={setDate}
          />
        </FormField>
      </div>
      <Button
        permission="finance.period.close"
        variant="outline"
        disabled={busy || !periodId}
        onClick={() => void preview()}
      >
        کنترل پیش‌نیازها
      </Button>
      {preflight ? (
        <>
          <p role="status">اسناد نهایی‌نشده: {preflight.unfinished}</p>
          <div className="overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  {['حساب', 'نوع', 'مانده'].map((t) => (
                    <th key={t} className="p-3 text-start">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preflight.balances.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">
                      {book.accounts.find((a) => a.id === r.accountId)?.title}
                    </td>
                    <td className="p-3">{r.permanent ? 'دائمی' : 'موقت'}</td>
                    <td className="p-3">{r.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            {mode === 'closing' ? (
              <>
                <Button
                  permission="finance.period.close"
                  disabled={
                    busy ||
                    preflight.unfinished > 0 ||
                    period?.status !== 'OPEN'
                  }
                  onClick={() => void generate(false)}
                >
                  ایجاد سند بستن موقت‌ها
                </Button>
                <Button
                  permission="finance.period.close"
                  variant="outline"
                  disabled={
                    busy ||
                    preflight.unfinished > 0 ||
                    period?.status !== 'OPEN'
                  }
                  onClick={() => {
                    if (
                      period &&
                      window.confirm(
                        'دوره بسته شود؟ ثبت سند جدید در این دوره متوقف خواهد شد.',
                      )
                    )
                      void run(
                        'close-period',
                        { id: period.id },
                        period.version,
                      ).then((r) => {
                        if (r) setPreflight(null);
                      });
                  }}
                >
                  بستن دوره
                </Button>
              </>
            ) : (
              <Button
                permission="finance.period.close"
                disabled={busy || period?.status !== 'CLOSED'}
                onClick={() => void generate(true)}
              >
                ایجاد سند افتتاحیه
              </Button>
            )}
          </div>
        </>
      ) : null}
      {result ? (
        <div role="status" className="rounded-xl bg-emerald-500/10 p-4">
          پیش‌نویس ایجاد شد؛ تأیید مستقل و ثبت قطعی در{' '}
          <Link
            href={`/finance/accounting/general-ledger/documents/list?bookId=${book.book.id}&journalId=${result.id}`}
            className="font-bold text-primary"
          >
            فهرست اسناد
          </Link>{' '}
          انجام می‌شود.
        </div>
      ) : null}
    </section>
  );
}
