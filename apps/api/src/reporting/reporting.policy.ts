import { BadRequestException } from '@nestjs/common';

import type {
  ReportFilterSnapshotV1,
  ReportQueryV1,
  ReportingExportRequestV1,
  ReportingGrain,
  ReportingMoneyV1,
} from './reporting.contracts';

export const MAX_PREVIEW_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CURRENCY = /^[A-Z]{3}$/;

function decimalUnits(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(value);
  if (!match) throw new BadRequestException('مبلغ Projection معتبر نیست.');
  const units =
    BigInt(match[2]!) * 10_000n + BigInt((match[3] ?? '').padEnd(4, '0'));
  return match[1] === '-' ? -units : units;
}
function unitsDecimal(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const fraction = (absolute % 10_000n)
    .toString()
    .padStart(4, '0')
    .replace(/0+$/, '');
  return `${sign}${absolute / 10_000n}${fraction ? `.${fraction}` : ''}`;
}

export function sumReportingDecimals(values: readonly string[]): string {
  return unitsDecimal(
    values.reduce((sum, value) => sum + decimalUnits(value), 0n),
  );
}

export function compareReportingDecimals(left: string, right: string): number {
  const delta = decimalUnits(left) - decimalUnits(right);
  return delta === 0n ? 0 : delta < 0n ? -1 : 1;
}

export function validateReportQuery(
  input: ReportQueryV1,
  maxPageSize = MAX_PAGE_SIZE,
): ReportQueryV1 {
  if (
    !input ||
    typeof input !== 'object' ||
    !input.filters ||
    typeof input.filters !== 'object' ||
    Array.isArray(input.filters)
  )
    throw new BadRequestException('ساختار درخواست گزارش معتبر نیست.');
  if (!Number.isInteger(input.page) || input.page < 1)
    throw new BadRequestException('شماره صفحه نامعتبر است.');
  if (
    !Number.isInteger(input.pageSize) ||
    input.pageSize < 1 ||
    input.pageSize > maxPageSize
  )
    throw new BadRequestException(
      `اندازه صفحه باید بین ۱ تا ${maxPageSize} باشد.`,
    );
  if (input.timezone !== 'Asia/Tehran')
    throw new BadRequestException('منطقه زمانی گزارش پشتیبانی نمی‌شود.');
  const filterEntries = Object.entries(input.filters);
  if (filterEntries.length > 32)
    throw new BadRequestException('تعداد فیلترهای گزارش بیش از حد مجاز است.');
  for (const [key, value] of filterEntries) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key))
      throw new BadRequestException('نام فیلتر گزارش معتبر نیست.');
    if (!(
      (typeof value === 'string' && value.length <= 160) ||
      (Array.isArray(value) &&
        value.length <= 50 &&
        value.every((item) => typeof item === 'string' && item.length <= 160))
    ))
      throw new BadRequestException(`مقدار فیلتر ${key} معتبر نیست.`);
  }
  if (
    input.sort &&
    (!input.sort.column ||
      !['ASC', 'DESC'].includes(input.sort.direction) ||
      input.sort.column.length > 64)
  )
    throw new BadRequestException('مرتب‌سازی گزارش معتبر نیست.');
  for (const key of ['fromUtc', 'toUtc']) {
    const value = input.filters[key];
    if (typeof value === 'string' && !ISO_DATE_TIME.test(value))
      throw new BadRequestException(`${key} باید زمان UTC معتبر باشد.`);
  }
  const fromUtc = input.filters.fromUtc;
  const toUtc = input.filters.toUtc;
  if (
    typeof fromUtc === 'string' &&
    typeof toUtc === 'string' &&
    fromUtc >= toUtc
  )
    throw new BadRequestException('ابتدای بازه باید پیش از انتهای بازه باشد.');
  if (
    typeof fromUtc === 'string' &&
    typeof toUtc === 'string' &&
    Date.parse(toUtc) - Date.parse(fromUtc) > 366 * 24 * 60 * 60 * 1000
  )
    throw new BadRequestException(
      'بازه پیش‌نمایش نمی‌تواند بیش از ۳۶۶ روز باشد.',
    );
  return input;
}

export function assertSingleCurrency(
  rows: readonly ReportingMoneyV1[],
): string {
  const currencies = new Set(
    rows.map((row) => {
      if (!CURRENCY.test(row.currencyCode))
        throw new BadRequestException('کد ارز باید ISO سه‌حرفی باشد.');
      return row.currencyCode;
    }),
  );
  if (currencies.size > 1)
    throw new BadRequestException(
      'جمع ارزهای متفاوت بدون FX Snapshot تأییدشده مجاز نیست.',
    );
  return currencies.values().next().value ?? '';
}

export function aggregateOnceByGrain<Row extends { grainId: string }>(
  rows: readonly Row[],
  amount: (row: Row) => bigint,
): bigint {
  const seen = new Set<string>();
  return rows.reduce((total, row) => {
    if (seen.has(row.grainId)) return total;
    seen.add(row.grainId);
    return total + amount(row);
  }, 0n);
}

export function escapeSpreadsheetCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function createFilterSnapshot(input: {
  reportCode: string;
  reportVersion: number;
  grain: ReportingGrain;
  query: ReportQueryV1;
  capturedAtUtc: string;
}): Readonly<ReportFilterSnapshotV1> {
  if (!ISO_DATE_TIME.test(input.capturedAtUtc))
    throw new BadRequestException('زمان Filter Snapshot باید UTC معتبر باشد.');
  const query = validateReportQuery(input.query);
  const filters = Object.fromEntries(
    Object.entries(query.filters).map(([key, value]) => [
      key,
      Array.isArray(value) ? Object.freeze([...value]) : value,
    ]),
  );
  return Object.freeze({
    reportCode: input.reportCode,
    reportVersion: input.reportVersion,
    grain: input.grain,
    capturedAtUtc: input.capturedAtUtc,
    timezone: query.timezone,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    branchIds: Object.freeze([...(query.branchIds ?? [])]),
    filters: Object.freeze(filters),
    ...(query.sort ? { sort: Object.freeze({ ...query.sort }) } : {}),
  });
}

export function validateExportRequest(
  request: ReportingExportRequestV1,
  permissions: readonly string[],
): ReportingExportRequestV1 {
  validateReportQuery(request.query);
  if (!permissions.includes('reporting.export'))
    throw new BadRequestException('مجوز خروجی گزارش وجود ندارد.');
  if (
    request.includeSensitive &&
    !permissions.includes('reporting.export_sensitive')
  )
    throw new BadRequestException('مجوز خروجی حساس وجود ندارد.');
  if (
    request.format === 'PDF' &&
    (!request.issuerLegalEntityId || request.issuerLegalEntityId === 'ALL')
  )
    throw new BadRequestException(
      'PDF رسمی به یک شرکت صادرکننده مشخص نیاز دارد.',
    );
  return request;
}
