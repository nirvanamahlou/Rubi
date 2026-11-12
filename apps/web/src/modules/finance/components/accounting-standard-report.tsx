'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { accountingApi } from '../api/accounting-api';
import { exportAccountingRows } from '../accounting-view-export';
import { AccountingButton as Button } from './accounting-operations';

type Report = {
  from: string;
  to: string;
  debit: string;
  credit: string;
  unmappedLines: number;
  standard: { title: string; attributes: { protocolVersion: string } };
  entities: { id: string; title: string; version: number }[];
  rows: {
    key: string;
    codes: ({ code: string; title: string } | null)[];
    debit: string;
    credit: string;
    balance: string;
    lines: number;
    unmapped: boolean;
  }[];
};
export function AccountingStandardReport({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const permissions = useAccessPermissions(),
    canExport = !!permissions?.includes('finance.export');
  const [standardId, setStandard] = useState(''),
    [periodId, setPeriod] = useState(book.periods[0]?.id ?? ''),
    [toPeriodId, setToPeriod] = useState(book.periods[0]?.id ?? '');
  const period = book.periods.find((row) => row.id === periodId),
    last = book.periods.find((row) => row.id === toPeriodId);
  const [from, setFrom] = useState(period?.startDate ?? ''),
    [to, setTo] = useState(last?.endDate ?? ''),
    [typeId, setType] = useState(''),
    [submitted, setSubmitted] = useState(false),
    [exportError, setExportError] = useState('');
  const query = useQuery({
    queryKey: [
      'accounting-standard-report',
      book.book.id,
      standardId,
      periodId,
      toPeriodId,
      from,
      to,
      typeId,
    ],
    enabled: submitted && !!standardId && !!periodId,
    queryFn: () =>
      accountingApi.analytical<Report>(book.book.id, 'standard-turnover', {
        standardId,
        periodId,
        toPeriodId,
        from,
        to,
        ...(typeId ? { typeId } : {}),
      }),
  });
  const data =
    submitted && !query.isFetching && !query.isError ? query.data : undefined;
  const periods = book.periods.map((row) => ({
    value: row.id,
    label:
      book.configurations.find((config) => config.id === row.fiscalYearId)
        ?.title ?? row.startDate,
  }));
  const headings = [
    ...(data?.entities.flatMap((entity) => [
      `کد ${entity.title}`,
      `عنوان ${entity.title}`,
    ]) ?? []),
    'بدهکار',
    'بستانکار',
    'مانده',
    'تعداد اقلام',
    'وضعیت نگاشت',
  ];
  const values = (row: Report['rows'][number]) => [
    ...row.codes.flatMap((code) => [
      code?.code ?? '',
      code?.title ?? 'نگاشت نشده',
    ]),
    row.debit,
    row.credit,
    row.balance,
    String(row.lines),
    row.unmapped ? 'ناقص' : 'کامل',
  ];
  const exportRows = async (format: 'xlsx' | 'pdf') => {
    if (!data || !canExport) return;
    setExportError('');
    try {
      await exportAccountingRows(
        [
          ['گزارش داخلی گردش کدینگ استاندارد'],
          ['دفتر کل', book.book.title, 'ارز', book.book.baseCurrency],
          [
            'کدینگ استاندارد',
            data.standard.title,
            'نسخه پروتکل',
            String(data.standard.attributes.protocolVersion),
          ],
          ['از تاریخ', data.from, 'تا تاریخ', data.to],
          ['مبنای گزارش', 'فقط اسناد قطعی؛ خروجی رسمی قانونی نیست'],
          ...data.entities.map((entity) => [
            entity.title,
            'نسخه نگاشت',
            String(entity.version),
          ]),
          ['تعداد اقلام با نگاشت ناقص', String(data.unmappedLines)],
          headings,
          ...data.rows.map(values),
          ['جمع بدهکار', data.debit, 'جمع بستانکار', data.credit],
        ],
        format,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'خروجی ناموفق بود.',
      );
    }
  };
  return (
    <section className="space-y-3 border p-3" aria-busy={query.isFetching}>
      <h2>گزارش کدینگ استاندارد</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <SearchCombobox
          label="کدینگ استاندارد"
          value={standardId}
          options={book.configurations
            .filter((row) => row.kind === 'coding-standards' && row.active)
            .map((row) => ({
              value: row.id,
              label: `${row.title} — ${row.attributes.protocolVersion || ''}`,
            }))}
          onValueChange={(id) => {
            setSubmitted(false);
            setStandard(id);
          }}
        />
        <label>
          نسخه پروتکل
          <input
            className="w-full border bg-slate-100"
            readOnly
            value={String(
              book.configurations.find((row) => row.id === standardId)
                ?.attributes.protocolVersion || '',
            )}
          />
        </label>
        <SearchCombobox
          label="نوع سند"
          value={typeId}
          options={book.configurations
            .filter((row) => row.kind === 'voucher-types')
            .map((row) => ({ value: row.id, label: row.title }))}
          onValueChange={(id) => {
            setSubmitted(false);
            setType(id);
          }}
        />
        <SearchCombobox
          label="از دوره مالی"
          value={periodId}
          options={periods}
          onValueChange={(id) => {
            setSubmitted(false);
            setPeriod(id);
            setFrom(book.periods.find((row) => row.id === id)?.startDate ?? '');
          }}
        />
        <SearchCombobox
          label="تا دوره مالی"
          value={toPeriodId}
          options={periods}
          onValueChange={(id) => {
            setSubmitted(false);
            setToPeriod(id);
            setTo(book.periods.find((row) => row.id === id)?.endDate ?? '');
          }}
        />
        <FormField label="از تاریخ">
          <DatePicker
            value={from}
            onChange={(value) => {
              setSubmitted(false);
              setFrom(value);
            }}
          />
        </FormField>
        <FormField label="تا تاریخ">
          <DatePicker
            value={to}
            onChange={(value) => {
              setSubmitted(false);
              setTo(value);
            }}
          />
        </FormField>
      </div>
      <fieldset disabled className="flex flex-wrap gap-4 text-xs">
        <legend>اسناد متمم</legend>
        {['حذف اسناد متمم دوره قبل', 'اضافه کردن اسناد متمم دوره بعد'].map(
          (label) => (
            <label key={label}>
              <input type="checkbox" /> {label}
            </label>
          ),
        )}
      </fieldset>
      <p className="text-xs">
        این گزارش، گردش داخلی اسناد قطعی بر اساس نگاشت فعلی است؛ قالب رسمی
        پروتکل و رفتار اسناد متمم تأیید نشده و فعال نیست.
      </p>
      <Button
        disabled={
          !standardId ||
          !periodId ||
          !toPeriodId ||
          !from ||
          !to ||
          query.isFetching
        }
        onClick={() => {
          if (submitted) void query.refetch();
          else setSubmitted(true);
        }}
      >
        گزارش
      </Button>
      {query.error && <p role="alert">{query.error.message}</p>}
      {exportError && <p role="alert">{exportError}</p>}
      {data && (
        <>
          <p>
            {book.book.title} — {book.book.baseCurrency} — {data.from} تا{' '}
            {data.to}
          </p>
          <p role="status">تعداد اقلام با نگاشت ناقص: {data.unmappedLines}</p>
          <div className="flex gap-2">
            <Button
              disabled={!canExport}
              onClick={() => void exportRows('xlsx')}
            >
              خروجی اکسل
            </Button>
            <Button
              disabled={!canExport}
              onClick={() => void exportRows('pdf')}
            >
              خروجی پی دی اف
            </Button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {headings.map((heading, index) => (
                    <th key={index} className="border p-2">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.key}>
                    {values(row).map((value, index) => (
                      <td key={index} className="border p-2">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            جمع بدهکار: {data.debit} — جمع بستانکار: {data.credit}
          </p>
        </>
      )}
    </section>
  );
}
