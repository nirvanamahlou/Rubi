'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import Link from '@/i18n/link';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input } from '@/components/ui/form-controls';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { apiRequest } from '../api/finance-inbox-api';
import { exportAccountingRows } from '../accounting-view-export';
import {
  internalReportAxes,
  internalReportFieldKey,
  internalReportQuery,
  sumReportValues,
  type InternalAccountingReportKind,
} from '../accounting-internal-report-model';
import { accountingParityByRoute } from './accounting-parity-definitions';
import { AccountingButton as Button } from './accounting-operations';
import { completionJournalHref } from '../accounting-completion-routes';

type Group = {
  key: string;
  dimensions: Record<string, string | null>;
  accountCode: string | null;
  accountTitle: string | null;
  opening: string;
  debit: string;
  credit: string;
  balance: string;
  foreignBalances: Record<string, string>;
  sourceLineIds: string[];
};
type Age = {
  key: string;
  accountId: string;
  accountCode: string;
  accountTitle: string;
  balance: string;
  side: string;
  buckets: string[];
  unknownAge: string;
};
type Line = {
  id: string;
  journalId: string;
  number: number | null;
  date: string;
  accountCode: string;
  accountTitle: string;
  description: string;
  debit: string;
  credit: string;
};
type Report = {
  currency: string;
  from: string;
  to: string;
  debit?: string;
  credit?: string;
  sourceCount: number;
  engineVersion: string;
  statutory: false;
  rows: Group[] | Age[];
  lines?: Line[];
};
export function AccountingInternalReport({
  book,
  kind,
}: {
  book: AccountingSnapshotV1;
  kind: InternalAccountingReportKind;
}) {
  const definition = accountingParityByRoute.get(
    `general-ledger/reports/${kind}`,
  )!;
  const initial = () =>
    ({
      periodId: book.periods[0]?.id ?? '',
      toPeriodId: book.periods[0]?.id ?? '',
      from: '',
      to: '',
      axes: 'account',
      rowAxis: 'account',
      columnAxis: 'month',
      includeOpening: true,
    }) as Record<string, string | boolean>;
  const [values, setValues] = useState(initial),
    [requested, setRequested] = useState<Record<string, string> | null>(null),
    [message, setMessage] = useState('');
  const parameters = internalReportQuery(values, kind),
    signature = JSON.stringify(parameters);
  const current = requested !== null && JSON.stringify(requested) === signature;
  const query = useQuery({
    queryKey: ['accounting', 'internal-report', book.book.id, kind, requested],
    enabled: current,
    retry: false,
    queryFn: () =>
      apiRequest<Report>(
        `/finance/accounting/books/${book.book.id}/completion/reports/${kind}?${new URLSearchParams(requested!)}`,
      ),
  });
  const data =
    current && !query.isFetching && !query.isError ? query.data : undefined;
  const change = (key: string, value: string | boolean) => {
    setValues((v) => ({ ...v, [key]: value }));
    setMessage('');
  };
  const labels = (dimension: string, value: string | null) => {
    if (!value) return '—';
    const r =
      dimension === 'account'
        ? book.accounts.find((a) => a.id === value)
        : dimension.startsWith('detail')
          ? book.details.find((d) => d.id === value)
          : undefined;
    return r ? `${r.code} — ${r.title}` : value;
  };
  const periods = book.periods.map((p) => ({
    value: p.id,
    label:
      book.configurations.find((c) => c.id === p.fiscalYearId)?.title ??
      p.startDate,
  }));
  const options = (key: string) =>
    key === 'periodId' || key === 'toPeriodId'
      ? periods
      : key === 'typeId'
        ? book.configurations
            .filter((c) => c.kind === 'voucher-types')
            .map((c) => ({ value: c.id, label: c.title }))
        : key === 'detailTypeId'
          ? book.configurations
              .filter((c) => c.kind === 'detail-types')
              .map((c) => ({ value: c.id, label: c.title }))
          : key === 'detailId'
            ? book.details.map((d) => ({
                value: d.id,
                label: `${d.code} — ${d.title}`,
              }))
            : key === 'accountId'
              ? book.accounts
                  .filter((a) =>
                    kind === 'legal-ledgers'
                      ? a.level === 'GENERAL'
                      : a.level === 'SUBSIDIARY',
                  )
                  .map((a) => ({
                    value: a.id,
                    label: `${a.code} — ${a.title}`,
                  }))
              : key === 'groupId'
                ? book.accountGroups.map((g) => ({
                    value: g.id,
                    label: g.title,
                  }))
                : ['axes', 'rowAxis', 'columnAxis'].includes(key)
                  ? internalReportAxes
                  : undefined;
  const exportRows = async () => {
    if (!data) return;
    const headers = data.lines
      ? ['شماره', 'تاریخ', 'کد', 'حساب', 'شرح', 'بدهکار', 'بستانکار']
      : kind === 'aging'
        ? [
            'کد',
            'حساب',
            'مانده',
            '۰ تا ۳۰ روز',
            '۳۱ تا ۶۰ روز',
            '۶۱ تا ۹۰ روز',
            '۹۱ تا ۱۲۰ روز',
            'بیش از ۱۲۰ روز',
            'سن نامعلوم',
          ]
        : ['گروه', 'مانده قبل بازه', 'بدهکار', 'بستانکار', 'مانده پایان'];
    const rows = data.lines
      ? data.lines.map((r) => [
          String(r.number ?? ''),
          r.date,
          r.accountCode,
          r.accountTitle,
          r.description,
          r.debit,
          r.credit,
        ])
      : kind === 'aging'
        ? (data.rows as Age[]).map((r) => [
            r.accountCode,
            r.accountTitle,
            r.balance,
            ...r.buckets,
            r.unknownAge,
          ])
        : (data.rows as Group[]).map((r) => [
            Object.entries(r.dimensions)
              .map(([axis, value]) => labels(axis, value))
              .join(' / '),
            r.opening,
            r.debit,
            r.credit,
            r.balance,
          ]);
    try {
      await exportAccountingRows(
        [[`${definition.title} — پیش‌نمایش داخلی`], headers, ...rows],
        'xlsx',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'خروجی انجام نشد.');
    }
  };
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-black">{definition.title}</h2>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!values.periodId || query.isFetching}
          onClick={() =>
            current ? void query.refetch() : setRequested(parameters)
          }
        >
          مشاهده گزارش
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setValues(initial());
            setRequested(null);
          }}
        >
          پاک کردن
        </Button>
        <Button
          permission="finance.export"
          variant="outline"
          disabled={!data}
          onClick={() => void exportRows()}
        >
          ارسال به Excel
        </Button>
        <Button
          variant="outline"
          disabled={!data}
          onClick={() => window.print()}
        >
          چاپ
        </Button>
      </div>
      <fieldset className="rounded-xl border bg-background p-4">
        <legend className="px-2 font-bold">فیلتر</legend>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {definition.fields.map((field, index) => {
            const key = internalReportFieldKey(field, kind),
              id = `internal-report-${field.sourceControlId ?? index}-${index}`,
              choices = key ? options(key) : undefined;
            const disabled = field.disabled || !key || query.isFetching;
            return (
              <FormField key={id} id={id} label={field.label}>
                <div data-source-control-id={field.sourceControlId}>
                  {field.type === 'checkbox' || field.type === 'radio' ? (
                    <input
                      id={id}
                      type={field.type}
                      checked={!!(key && values[key])}
                      disabled={disabled}
                      onChange={(e) => key && change(key, e.target.checked)}
                    />
                  ) : field.type === 'date' ? (
                    <DatePicker
                      id={id}
                      value={key ? String(values[key] ?? '') : ''}
                      disabled={disabled}
                      onChange={(value) => key && change(key, value)}
                    />
                  ) : choices ? (
                    <SearchCombobox
                      id={id}
                      label={field.label}
                      value={String(values[key!] ?? '')}
                      options={choices}
                      disabled={disabled || !choices.length}
                      onValueChange={(value) => change(key!, value)}
                    />
                  ) : (
                    <Input
                      id={id}
                      value={key ? String(values[key] ?? '') : ''}
                      disabled={disabled}
                      onChange={(e) => key && change(key, e.target.value)}
                    />
                  )}
                </div>
              </FormField>
            );
          })}
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        مبنای محاسبه اسناد قطعی و مبلغ ارز پایه دفتر است. گزینه‌های فاقد مرجع
        داخلی غیرفعال‌اند.
      </p>
      {kind === 'legal-ledgers' && (
        <p role="status">
          این خروجی پیش‌نمایش داخلی دفتر است؛ فایل قانونی به قالب مصوب همان دوره
          نیاز دارد.
        </p>
      )}
      {kind === 'aging' && (
        <p>
          تجزیه سنی بر مبنای تاریخ سند و تخمین FIFO است؛ سن نامعلوم افتتاحیه جدا
          نمایش داده می‌شود.
        </p>
      )}
      {current && query.isFetching && <p role="status">در حال بارگذاری…</p>}
      {current && query.isError && (
        <p role="alert">
          {query.error instanceof Error
            ? query.error.message
            : 'گزارش ناموفق بود.'}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <p>
            {data.from} تا {data.to} · {data.currency} · اقلام منبع:{' '}
            {data.sourceCount}
          </p>
          <div className="overflow-auto rounded-xl border">
            {data.lines ? (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      'شماره',
                      'تاریخ',
                      'کد',
                      'حساب',
                      'شرح',
                      'بدهکار',
                      'بستانکار',
                    ].map((h) => (
                      <th className="p-3 text-start" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3">
                        <Link
                          className="text-primary"
                          href={completionJournalHref(
                            book.book.id,
                            r.journalId,
                          )}
                        >
                          {r.number ?? '—'}
                        </Link>
                      </td>
                      {[
                        r.date,
                        r.accountCode,
                        r.accountTitle,
                        r.description,
                        r.debit,
                        r.credit,
                      ].map((v, i) => (
                        <td className="border-t p-3" key={i}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : kind === 'aging' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      'کد',
                      'حساب',
                      'مانده',
                      '۰ تا ۳۰ روز',
                      '۳۱ تا ۶۰ روز',
                      '۶۱ تا ۹۰ روز',
                      '۹۱ تا ۱۲۰ روز',
                      'بیش از ۱۲۰ روز',
                      'سن نامعلوم',
                    ].map((h) => (
                      <th className="p-3 text-start" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.rows as Age[]).map((r) => (
                    <tr key={r.key}>
                      {[
                        r.accountCode,
                        r.accountTitle,
                        r.balance,
                        ...r.buckets,
                        r.unknownAge,
                      ].map((value, i) => (
                        <td className="border-t p-3" key={i}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : kind === 'matrix' ? (
              <InternalMatrix
                rows={data.rows as Group[]}
                rowAxis={String(values.rowAxis)}
                columnAxis={String(values.columnAxis)}
                label={labels}
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {[
                      'گروه',
                      'مانده قبل بازه',
                      'بدهکار',
                      'بستانکار',
                      'مانده پایان',
                      'مانده ارزی به تفکیک ارز',
                    ].map((h) => (
                      <th className="p-3 text-start" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.rows as Group[]).map((r) => (
                    <tr key={r.key}>
                      <td className="p-3">
                        {Object.entries(r.dimensions)
                          .map(([axis, value]) => labels(axis, value))
                          .join(' / ')}
                      </td>
                      {[
                        r.opening,
                        r.debit,
                        r.credit,
                        r.balance,
                        Object.entries(r.foreignBalances)
                          .map(([currency, value]) => `${currency}: ${value}`)
                          .join(' / ') || '—',
                      ].map((value, i) => (
                        <td className="border-t p-3" key={i}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!data.rows.length && !data.lines?.length && (
            <p role="status">سطری برای نمایش وجود ندارد.</p>
          )}
          {data.debit !== undefined && (
            <p>
              بدهکار: {data.debit} · بستانکار: {data.credit}
            </p>
          )}
        </>
      )}
    </section>
  );
}
function InternalMatrix({
  rows,
  rowAxis,
  columnAxis,
  label,
}: {
  rows: Group[];
  rowAxis: string;
  columnAxis: string;
  label: (axis: string, value: string | null) => string;
}) {
  const rowKeys = [...new Set(rows.map((r) => r.dimensions[rowAxis] ?? null))],
    columns = [...new Set(rows.map((r) => r.dimensions[columnAxis] ?? null))];
  const cells = new Map<string, string[]>(),
    rowTotals = new Map<string | null, string[]>(),
    columnTotals = new Map<string | null, string[]>();
  const append = <K,>(map: Map<K, string[]>, key: K, value: string) => {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  };
  for (const item of rows) {
    const row = item.dimensions[rowAxis] ?? null,
      column = item.dimensions[columnAxis] ?? null;
    append(cells, JSON.stringify([row, column]), item.balance);
    append(rowTotals, row, item.balance);
    append(columnTotals, column, item.balance);
  }
  const cell = (row: string | null, column: string | null) =>
    cells.get(JSON.stringify([row, column])) ?? [];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          <th className="p-3 text-start">مانده ارز پایه</th>
          {columns.map((c, i) => (
            <th className="p-3 text-start" key={i}>
              {label(columnAxis, c)}
            </th>
          ))}
          <th className="p-3 text-start">جمع</th>
        </tr>
      </thead>
      <tbody>
        {rowKeys.map((r, i) => (
          <tr key={i}>
            <td className="p-3">{label(rowAxis, r)}</td>
            {columns.map((c, j) => (
              <td key={j} className="border-t p-3">
                {cell(r, c).length ? sumReportValues(cell(r, c)) : '—'}
              </td>
            ))}
            <td className="border-t p-3">
              {sumReportValues(rowTotals.get(r) ?? [])}
            </td>
          </tr>
        ))}
        <tr>
          <th className="p-3 text-start">جمع</th>
          {columns.map((c, j) => (
            <td className="p-3" key={j}>
              {sumReportValues(columnTotals.get(c) ?? [])}
            </td>
          ))}
          <td className="p-3">{sumReportValues(rows.map((r) => r.balance))}</td>
        </tr>
      </tbody>
    </table>
  );
}
