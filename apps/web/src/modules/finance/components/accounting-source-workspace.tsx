'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  AccountingSnapshotV1,
  AccountingJournalV1,
  AccountingCommandV1,
  AccountingSourcePageV1,
} from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { FormField } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import Link from '@/i18n/link';
import { apiRequest } from '../api/finance-inbox-api';

export function AccountingSourceWorkspace({
  book,
  run,
  busy,
}: {
  book: AccountingSnapshotV1;
  busy: boolean;
  run: <T = unknown>(
    action: string,
    payload: AccountingCommandV1['payload'],
    version?: number,
  ) => Promise<T | undefined>;
}) {
  const params = useSearchParams();
  const recordId = params.get('recordId') ?? '',
    requestId = params.get('requestId') ?? '';
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [cursor, setCursor] = useState(''),
    [direction, setDirection] = useState(''),
    [source, setSource] = useState(params.get('source') ?? '');
  const [selected, setSelected] = useState(recordId),
    [periodId, setPeriodId] = useState(''),
    [typeId, setTypeId] = useState(''),
    [date, setDate] = useState(''),
    [debit, setDebit] = useState(''),
    [credit, setCredit] = useState('');
  const query = useQuery({
    queryKey: [
      'accounting',
      'sources',
      book.book.id,
      cursor,
      direction,
      source,
      from,
      to,
      recordId,
      requestId,
    ],
    queryFn: () =>
      apiRequest<AccountingSourcePageV1>(
        `/finance/accounting/books/${book.book.id}/sources?${new URLSearchParams({ ...(cursor ? { cursor } : {}), ...(direction ? { direction } : {}), ...(source ? { source } : {}), ...(recordId ? { recordId } : {}), ...(requestId ? { requestId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) })}`,
      ),
  });
  const options = (rows: { id: string; title: string; code?: string }[]) =>
    rows.map((r) => ({ value: r.id, label: `${r.code ?? ''} ${r.title}` }));
  const item = query.data?.items.find((i) => i.id === selected);
  const create = async () => {
    if (!item) return;
    const journal = await run<AccountingJournalV1>('source-journal', {
      source: item.source,
      recordId: item.id,
      periodId,
      typeId,
      documentDate: date,
      debitAccountId: debit,
      creditAccountId: credit,
    });
    if (journal) {
      setSelected('');
      await query.refetch();
    }
  };
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-black">دریافت و پرداخت و سند مرتبط</h2>
      <div className="flex flex-wrap gap-3">
        <FormField label="از تاریخ">
          <DatePicker
            aria-label="از تاریخ"
            value={from}
            onChange={(v) => {
              setFrom(v);
              setCursor('');
            }}
          />
        </FormField>
        <FormField label="تا تاریخ">
          <DatePicker
            aria-label="تا تاریخ"
            value={to}
            onChange={(v) => {
              setTo(v);
              setCursor('');
            }}
          />
        </FormField>
        <SearchCombobox
          label="جهت عملیات"
          value={direction}
          onValueChange={(v) => {
            setDirection(v);
            setCursor('');
          }}
          options={[
            { value: 'RECEIPT', label: 'دریافت' },
            { value: 'PAYMENT', label: 'پرداخت' },
          ]}
        />
        <SearchCombobox
          label="منبع"
          value={source}
          onValueChange={(v) => {
            setSource(v);
            setCursor('');
          }}
          options={[
            { value: 'SALES', label: 'فروش' },
            { value: 'TICKET', label: 'بلیت' },
            { value: 'RESERVATIONS', label: 'رزرواسیون' },
            { value: 'INVOICE', label: 'فاکتور خرید' },
            { value: 'OPERATIONAL', label: 'عملیات مالی' },
          ]}
        />
        <Button variant="outline" onClick={() => void query.refetch()}>
          به‌روزرسانی
        </Button>
      </div>
      {query.error ? (
        <p role="alert" className="text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {query.isPending ? (
        <p role="status">در حال بارگذاری…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {[
                  'تاریخ',
                  'عملیات',
                  'مبلغ',
                  'ارز',
                  'حساب تسویه',
                  'حسابداری',
                  'عملیات',
                ].map((label) => (
                  <th key={label} className="p-3 text-start">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((row) => (
                <tr key={row.source + row.id} className="border-t">
                  <td className="p-3">{row.occurredAt.slice(0, 10)}</td>
                  <td className="p-3">{row.title}</td>
                  <td className="p-3">{row.amount}</td>
                  <td className="p-3">{row.currencyCode}</td>
                  <td className="p-3">{row.accountTitle ?? '—'}</td>
                  <td className="p-3">
                    {row.accounting
                      ? row.accounting.status === 'POSTED'
                        ? `قطعی ${row.accounting.number}`
                        : 'سند ایجاد شده'
                      : 'بدون سند'}
                  </td>
                  <td className="p-3">
                    {row.accounting ? (
                      <Link
                        href={`/finance/accounting/general-ledger/documents/list?bookId=${book.book.id}&journalId=${row.accounting.id}`}
                        className="font-semibold text-primary"
                      >
                        مشاهده سند
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        permission="finance.journal.create"
                        onClick={() => setSelected(row.id)}
                      >
                        ایجاد پیش‌نویس
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={!cursor}
          onClick={() => setCursor('')}
        >
          ابتدای فهرست
        </Button>
        <Button
          variant="outline"
          disabled={!query.data?.nextCursor}
          onClick={() => setCursor(query.data?.nextCursor ?? '')}
        >
          بعدی
        </Button>
      </div>
      {item ? (
        <form
          className="space-y-4 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <h3 className="font-bold">
            پیش‌نویس از {item.title} · {item.amount} {item.currencyCode}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="دوره مالی">
              <SearchCombobox
                label="دوره مالی"
                value={periodId}
                onValueChange={setPeriodId}
                options={book.periods
                  .filter((p) => p.status === 'OPEN')
                  .map((p) => ({
                    value: p.id,
                    label:
                      book.configurations.find((c) => c.id === p.fiscalYearId)
                        ?.title ?? p.startDate,
                  }))}
              />
            </FormField>
            <FormField label="نوع سند">
              <SearchCombobox
                label="نوع سند"
                value={typeId}
                onValueChange={setTypeId}
                options={options(
                  book.configurations.filter(
                    (c) => c.kind === 'voucher-types' && c.active,
                  ),
                )}
              />
            </FormField>
            <FormField label="تاریخ سند">
              <DatePicker
                aria-label="تاریخ سند"
                value={date}
                onChange={setDate}
              />
            </FormField>
            <FormField label="حساب بدهکار">
              <SearchCombobox
                label="حساب بدهکار"
                value={debit}
                onValueChange={setDebit}
                options={options(
                  book.accounts.filter(
                    (a) => a.active && a.level === 'SUBSIDIARY',
                  ),
                )}
              />
            </FormField>
            <FormField label="حساب بستانکار">
              <SearchCombobox
                label="حساب بستانکار"
                value={credit}
                onValueChange={setCredit}
                options={options(
                  book.accounts.filter(
                    (a) => a.active && a.level === 'SUBSIDIARY',
                  ),
                )}
              />
            </FormField>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={busy}
              permission="finance.journal.create"
              type="submit"
            >
              ایجاد پیش‌نویس حسابداری
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => setSelected('')}
            >
              لغو
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
