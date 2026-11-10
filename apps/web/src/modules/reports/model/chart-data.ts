import type { SalesByOrganizationReportResult } from './client';
import { reportSortApiColumn } from './client';
import { isReportMoneyColumn } from './report-money-format';

type Result = SalesByOrganizationReportResult;
const rowAliases: Readonly<Record<string, string>> = {
  salesAmount: 'amount',
  orderCount: 'contractCount',
};
const moneyCodes: Readonly<Record<string, string>> = {
  ریال: 'IRR',
  '€': 'EUR',
  $: 'USD',
};
export type ReportChartMetric = { key: string; label: string; money: boolean };
export type ReportChartGroup = {
  row: Result['rows'][number];
  values: readonly { amount: string; currencyCode: string }[];
};

export function reportChartMetric(
  result: Result | null,
  selected: string,
  fallbackLabel: string,
): ReportChartMetric {
  const key = reportSortApiColumn(selected);
  const column = result?.columns?.find((c) => c.key === key);
  if (column && (column.kind === 'NUMBER' || isReportMoneyColumn(column)))
    return { key, label: column.label, money: isReportMoneyColumn(column) };
  if (!result?.columns) {
    const legacy: Record<string, string> = {
      orderCount: 'تعداد قرارداد',
      passengerCount: 'تعداد مسافر',
      ticketCount: 'تعداد بلیت',
    };
    if (legacy[key]) return { key, label: legacy[key], money: false };
  }
  const defaultColumn =
    result?.columns?.find((c) => c.key === result.chartMeasure) ??
    result?.columns?.find((c) => c.key === 'salesAmount') ??
    result?.columns?.find((c) => c.kind === 'NUMBER' || isReportMoneyColumn(c));
  return defaultColumn
    ? {
        key: defaultColumn.key,
        label: defaultColumn.label,
        money: isReportMoneyColumn(defaultColumn),
      }
    : { key: 'salesAmount', label: fallbackLabel, money: true };
}

export function isReportChartMetric(
  result: Result | null,
  selected: string,
): boolean {
  const key = reportSortApiColumn(selected);
  const column = result?.columns?.find((c) => c.key === key);
  return column
    ? column.kind === 'NUMBER' || isReportMoneyColumn(column)
    : !result?.columns &&
        ['salesAmount', 'orderCount', 'passengerCount', 'ticketCount'].includes(
          key,
        );
}

export function reportChartGroups(
  result: Result | null,
  metric: ReportChartMetric,
): ReportChartGroup[] {
  return (result?.rows ?? []).map((row) => {
    if (
      metric.money &&
      metric.key === 'salesAmount' &&
      row.amountsByCurrency?.length
    )
      return { row, values: row.amountsByCurrency };
    const alias = rowAliases[metric.key] ?? metric.key;
    const raw =
      row.sourceValues?.[metric.key] ??
      Object.entries(row).find(([key]) => key === alias)?.[1] ??
      (metric.key === result?.chartMeasure ? row.amount : undefined);
    const text =
      typeof raw === 'number' || typeof raw === 'string' ? String(raw) : '';
    if (!metric.money)
      return {
        row,
        values: /^-?\d+(?:\.\d+)?$/.test(text)
          ? [{ amount: text, currencyCode: '' }]
          : [],
      };
    const parts = text.split(' + ').map((part) => {
      const match = /^(-?[\d,]+(?:\.\d+)?)\s*(ریال|€|\$|[A-Z]{3})?$/.exec(part);
      if (!match) return null;
      return {
        amount: match[1]!.replaceAll(',', ''),
        currencyCode: match[2]
          ? (moneyCodes[match[2]] ?? match[2])
          : row.currencyCode,
      };
    });
    return {
      row,
      values: parts.filter(
        (value): value is NonNullable<typeof value> => value !== null,
      ),
    };
  });
}
