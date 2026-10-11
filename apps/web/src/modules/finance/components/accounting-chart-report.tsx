'use client';

import { Fragment, useState } from 'react';
import type {
  AccountingSnapshotV1,
  AccountingAccountV1,
} from '@nora/contracts';
import { accountingApi } from '../api/accounting-api';
import { AccountingButton } from './accounting-operations';
import {
  chartReportOptions,
  createChartReport,
  type ChartReportFormat,
  type ChartReportStructure,
  type ChartReportSelection,
} from '../accounting-chart-report';

const formatLabels = {
  GROUP: 'گروه حساب',
  GENERAL: 'حساب کل',
  SUBSIDIARY: 'معین',
  STRUCTURAL: 'گزارش ساختاری',
} as const;
const structures = [
  ['accounts', 'ساختار حساب ها'],
  ['detail-types', 'انواع تفصیلی تخصیص داده شده به سطوح'],
  ['counterparts', 'حساب های معین طرف مقابل'],
] as const;

export function AccountingChartReport({
  book,
}: {
  book: AccountingSnapshotV1;
}) {
  const [format, setFormat] = useState<ChartReportFormat>('STRUCTURAL');
  const [structure, setStructure] = useState<ChartReportStructure>('accounts');
  const [choices, setChoices] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      Object.entries(chartReportOptions).map(([key, values]) => [
        key,
        values.filter(([, , checked]) => checked).map(([id]) => id),
      ]),
    ),
  );
  const [selection, setSelection] = useState<ChartReportSelection | null>(null);
  const [targetAccounts, setTargetAccounts] = useState<AccountingAccountV1[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const result = selection
    ? createChartReport(book, selection, targetAccounts)
    : null;
  const generate = async () => {
    setError('');
    setSelection(null);
    setBusy(true);
    try {
      const selected = choices[format] ?? [];
      if (
        format === 'SUBSIDIARY' &&
        selected.includes('mapping') &&
        book.subsidiaryMappings?.length
      ) {
        const accessible = await accountingApi.books();
        const snapshots = await Promise.all(
          accessible.books
            .filter((item) => item.id !== book.book.id)
            .map((item) => accountingApi.snapshot(item.id)),
        );
        const targets = snapshots.flatMap((item) => item.accounts);
        if (
          book.subsidiaryMappings.some(
            (mapping) =>
              !targets.some(
                (account) => account.id === mapping.targetAccountId,
              ) &&
              !book.accounts.some(
                (account) => account.id === mapping.targetAccountId,
              ),
          )
        )
          throw new Error('حساب مقصد نگاشت در دفترهای قابل دسترس یافت نشد.');
        setTargetAccounts(targets);
      }
      setSelection({ format, structure, selected });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'دریافت اطلاعات گزارش ناموفق بود.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      dir="rtl"
      className="space-y-3 text-xs"
      data-accounting-route="general-ledger/reports/chart-structure"
    >
      <div className="flex gap-2 print:hidden">
        <AccountingButton disabled={busy} onClick={() => void generate()}>
          گزارش
        </AccountingButton>
        {result && (
          <AccountingButton onClick={() => window.print()}>
            چاپ
          </AccountingButton>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <fieldset
        disabled={busy}
        className="space-y-4 border border-slate-300 bg-white p-3 print:hidden"
      >
        <legend className="px-2">انواع فرمت ها</legend>
        {(Object.keys(formatLabels) as ChartReportFormat[]).map((value) => (
          <div key={value} className="border-b pb-3 last:border-0">
            <label className="flex items-center gap-2 font-bold">
              <input
                type="radio"
                name="chart-report-format"
                value={value}
                checked={format === value}
                onChange={() => {
                  setFormat(value);
                  setSelection(null);
                }}
              />
              {formatLabels[value]}
            </label>
            {value !== 'STRUCTURAL' ? (
              <div className="ms-6 mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {chartReportOptions[value].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(choices[value] ?? []).includes(key)}
                      disabled={
                        key === 'taxType' &&
                        !(choices[value] ?? []).includes('taxFeature')
                      }
                      onChange={(event) => {
                        setChoices((old) => ({
                          ...old,
                          [value]: event.target.checked
                            ? [...(old[value] ?? []), key]
                            : (old[value] ?? []).filter(
                                (item) =>
                                  item !== key &&
                                  !(key === 'taxFeature' && item === 'taxType'),
                              ),
                        }));
                        setSelection(null);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : (
              <div className="ms-6 mt-3 flex flex-wrap gap-5">
                {structures.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="chart-report-structure"
                      value={key}
                      checked={structure === key}
                      onChange={() => {
                        setStructure(key);
                        setSelection(null);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </fieldset>
      {result && (
        <div
          id="accounting-chart-report-output"
          className="overflow-auto border bg-white"
          aria-live="polite"
        >
          <style>{`@media print { body * { visibility: hidden; } #accounting-chart-report-output, #accounting-chart-report-output * { visibility: visible; } #accounting-chart-report-output { position: absolute; inset: 0; overflow: visible; border: 0; } #accounting-chart-report-output thead { display: table-header-group; } #accounting-chart-report-output tr { break-inside: avoid; } }`}</style>
          <h2 className="p-3 font-bold">
            {selection?.format === 'STRUCTURAL'
              ? selection.structure === 'detail-types'
                ? 'انواع تفصیلی تخصیص یافته به سطوح'
                : 'گزارش ساختار حساب ها'
              : selection?.format === 'SUBSIDIARY'
                ? 'حساب معین'
                : selection
                  ? formatLabels[selection.format]
                  : ''}
          </h2>
          <table className="w-full border-collapse text-right">
            <thead
              className="bg-sky-50"
              hidden={
                selection?.format === 'STRUCTURAL' &&
                selection.structure === 'detail-types'
              }
            >
              <tr>
                {result.columns.map((column) => (
                  <th scope="col" className="border p-2" key={column.key}>
                    {column.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) =>
                selection?.format === 'STRUCTURAL' &&
                selection.structure === 'accounts' &&
                row.level !== 'SUBSIDIARY' ? (
                  <tr key={row.id} className="bg-slate-50">
                    <th
                      scope="row"
                      colSpan={result.columns.length}
                      className="border p-3 text-right"
                    >
                      {row.level === 'GROUP' ? 'گروه حساب' : 'حساب کل'}:{' '}
                      {row.values.code}-{row.values.title}
                    </th>
                  </tr>
                ) : selection?.format === 'STRUCTURAL' &&
                  selection.structure === 'detail-types' ? (
                  <Fragment key={row.id}>
                    <tr>
                      <th
                        scope="row"
                        colSpan={result.columns.length}
                        className="border p-3"
                      >
                        {row.values.code}-{row.values.title}
                      </th>
                    </tr>
                    {[4, 5, 6]
                      .filter((level) => !!row.values[`detail${level}`])
                      .map((level) => (
                        <tr key={level}>
                          <td
                            colSpan={result.columns.length}
                            className="border p-3"
                          >
                            <p>انواع تفصیلی سطح: ({level})</p>
                            <p className="pt-2">
                              {row.values[`detail${level}`]}
                            </p>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ) : (
                  <tr key={row.id}>
                    {result.columns.map((column) => (
                      <td
                        key={column.key}
                        className="border p-2"
                        style={
                          column.key === 'title'
                            ? { paddingInlineStart: `${row.depth * 18 + 8}px` }
                            : undefined
                        }
                      >
                        {row.values[column.key]}
                      </td>
                    ))}
                  </tr>
                ),
              )}
              {!result.rows.length && (
                <tr>
                  <td colSpan={result.columns.length} className="p-4">
                    سطری برای نمایش وجود ندارد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
