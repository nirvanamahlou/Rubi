import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import type {
  ReportQueryV1,
  TravelReportResultV1,
} from './reporting.contracts';
import { isReportMoneyColumn } from './reporting-money-format';

export interface ReportColumnFilter {
  key: string;
  label: string;
  options: readonly string[];
}
const columnKey = (key: string) =>
  'column' + key[0]!.toUpperCase() + key.slice(1);
export function isOutputFilterKey(key: string) {
  return key === 'search' || /^column[A-Z][A-Za-z0-9]*$/.test(key);
}
/** Strip presentation predicates before calling an owning domain; all source permissions remain mandatory. */
export function reportSourceQuery(query: ReportQueryV1): ReportQueryV1 {
  return {
    ...query,
    filters: Object.fromEntries(
      Object.entries(query.filters).filter(([key]) => !isOutputFilterKey(key)),
    ),
  };
}
const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[,٬]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR');
const valueOf = (
  row: TravelReportResultV1['rows'][number],
  key: string,
): string =>
  String(
    row.sourceValues?.[key] ??
      Object.entries(row).find(([name]) => name === key)?.[1] ??
      '',
  );
/** Filter authorized report-grain rows before pagination, consistently for charts and exports. */
export function filterReportOutput(
  result: TravelReportResultV1,
  query: ReportQueryV1,
  allRows = false,
): TravelReportResultV1 {
  const columns = result.columns.filter(
    (c) =>
      c.kind === 'TEXT' && !isReportMoneyColumn(c) && c.key !== 'currencyCode',
  );
  const definitions: ReportColumnFilter[] = columns.map((c) => ({
    key: columnKey(c.key),
    label: c.label,
    options: [
      ...new Set(
        result.rows
          .map((r) => valueOf(r, c.key))
          .filter((value) => Boolean(value) && value.length <= 160),
      ),
    ].sort((a, b) => a.localeCompare(b, 'fa')),
  }));
  const predicates: ((row: TravelReportResultV1['rows'][number]) => boolean)[] =
    [];
  for (const [key, value] of Object.entries(query.filters)) {
    if (
      !isOutputFilterKey(key) ||
      value === '' ||
      (Array.isArray(value) && !value.length)
    )
      continue;
    if (key === 'search') {
      if (typeof value !== 'string')
        throw new BadRequestException('فیلتر جست‌وجو باید متن باشد.');
      const term = normalize(value);
      if (term)
        predicates.push((row) =>
          result.columns.some((c) =>
            normalize(valueOf(row, c.key)).includes(term),
          ),
        );
    } else {
      const c = columns.find((c) => columnKey(c.key) === key);
      if (!c)
        throw new BadRequestException(
          'فیلتر انتخاب‌شده با ستون‌های این گزارش سازگار نیست.',
        );
      const selected = typeof value === 'string' ? [value] : value;
      predicates.push((row) => selected.includes(valueOf(row, c.key)));
    }
  }
  const rows = result.rows.filter((row) =>
    predicates.every((predicate) => predicate(row)),
  );
  const totals = new Map<
    string,
    Record<
      | 'salesAmount'
      | 'purchaseAmount'
      | 'grossProfit'
      | 'refundAmount'
      | 'settlementBalance',
      Prisma.Decimal
    >
  >();
  if (predicates.length && result.totalsByCurrency.length)
    for (const row of rows) {
      if (
        result.reportCode === 'sales_contract_pipeline' &&
        ![
          'CONFIRMED',
          'SENT_TO_RESERVATIONS',
          'IN_PROGRESS',
          'COMPLETED',
        ].includes(row.primaryDimension)
      )
        continue;
      const amounts = row.amountsByCurrency ?? [
        { currencyCode: row.currencyCode, amount: row.salesAmount },
      ];
      for (const money of amounts) {
        const total = totals.get(money.currencyCode) ?? {
          salesAmount: new Prisma.Decimal(0),
          purchaseAmount: new Prisma.Decimal(0),
          grossProfit: new Prisma.Decimal(0),
          refundAmount: new Prisma.Decimal(0),
          settlementBalance: new Prisma.Decimal(0),
        };
        total.salesAmount = total.salesAmount.plus(money.amount);
        if (!row.amountsByCurrency)
          for (const key of [
            'purchaseAmount',
            'grossProfit',
            'refundAmount',
            'settlementBalance',
          ] as const)
            total[key] = total[key].plus(row[key]);
        totals.set(money.currencyCode, total);
      }
    }
  return {
    ...result,
    columnFilters: definitions,
    rows: allRows
      ? rows
      : rows.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
    total: rows.length,
    page: query.page,
    pageSize: query.pageSize,
    ...(predicates.length
      ? {
          totalsByCurrency: [...totals].map(([currencyCode, values]) => ({
            currencyCode,
            salesAmount: values.salesAmount.toString(),
            purchaseAmount: values.purchaseAmount.toString(),
            grossProfit: values.grossProfit.toString(),
            refundAmount: values.refundAmount.toString(),
            settlementBalance: values.settlementBalance.toString(),
          })),
        }
      : {}),
    filterSnapshot: {
      ...result.filterSnapshot,
      filters: {
        ...result.filterSnapshot.filters,
        ...Object.fromEntries(
          Object.entries(query.filters).filter(([key]) =>
            isOutputFilterKey(key),
          ),
        ),
      },
    },
  };
}
