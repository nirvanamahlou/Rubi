import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceInboxItemV1,
  FinanceInboxQueryV1,
} from '@nora/contracts';

export const CLOSED_FINANCE_STATUSES = new Set([
  'APPROVED',
  'PAID',
  'RECEIPT_CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'RETURNED',
]);
const statuses = [
  'NEW',
  'UNDER_REVIEW',
  'CORRECTION_REQUIRED',
  'APPROVED',
  'READY_FOR_PAYMENT',
  'PAYING',
  'PAID',
  'RECEIPT_CONFIRMED',
  'REJECTED',
  'CANCELLED',
  'RETURNED',
  'REQUIRES_MANUAL_REVIEW',
  'OPEN',
  'CLOSED',
];
export function isClosedFinanceItem(item: FinanceInboxItemV1) {
  return item.status === 'APPROVED'
    ? item.kind === 'HR_REFERRAL'
    : CLOSED_FINANCE_STATUSES.has(item.status);
}
/** Eight fractional digits, compared without binary floating-point conversion. */
export function decimalUnits(value: string): bigint {
  if (!/^\d{1,24}(?:\.\d{1,8})?$/.test(value))
    throw new BadRequestException('مبلغ فیلتر معتبر نیست.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100000000n + BigInt(fraction.padEnd(8, '0'));
}
export function decimalText(units: bigint) {
  const fraction = (units % 100000000n)
    .toString()
    .padStart(8, '0')
    .replace(/0+$/, '');
  return (units / 100000000n).toString() + (fraction ? '.' + fraction : '');
}
function day(value: string | undefined) {
  if (value === undefined || value === '') return null;
  const parsed = new Date(value + 'T00:00:00Z');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('تاریخ فیلتر معتبر نیست.');
  return Date.parse(value + 'T00:00:00+03:30');
}
export function validateInboxQuery(
  query: FinanceInboxQueryV1,
  actor: AuthenticatedActor,
) {
  for (const key of [
    'search',
    'source',
    'status',
    'branchId',
    'person',
    'currencyCode',
    'minAmount',
    'maxAmount',
    'fromDate',
    'toDate',
    'dueFrom',
    'dueTo',
  ] as const)
    if (query[key] !== undefined && typeof query[key] !== 'string')
      throw new BadRequestException('نوع فیلتر معتبر نیست.');
  if (query.branchId && !actor.branchIds.includes(query.branchId))
    throw new ForbiddenException('شعبه خارج از دسترسی است.');
  if (
    (query.source &&
      !['SALES', 'HR', 'RESERVATIONS', 'PURCHASES', 'FINANCE'].includes(query.source)) ||
    (query.status && !statuses.includes(query.status)) ||
    (query.currencyCode && !/^[A-Z]{3}$/.test(query.currencyCode)) ||
    (query.search?.length ?? 0) > 200 ||
    (query.person?.length ?? 0) > 200
  )
    throw new BadRequestException('فیلتر کارتابل معتبر نیست.');
  const min = query.minAmount ? decimalUnits(query.minAmount) : null;
  const max = query.maxAmount ? decimalUnits(query.maxAmount) : null;
  if (min !== null && max !== null && min > max)
    throw new BadRequestException('بازه مبلغ وارونه است.');
  for (const [from, to] of [
    [query.fromDate, query.toDate],
    [query.dueFrom, query.dueTo],
  ]) {
    const start = day(from),
      end = day(to);
    if (start !== null && end !== null && start > end)
      throw new BadRequestException('بازه تاریخ وارونه است.');
  }
  const page = Number(query.page ?? 1),
    pageSize = Number(query.pageSize ?? 25);
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    throw new BadRequestException('صفحه‌بندی معتبر نیست.');
  return { page, pageSize };
}
function inDays(value: string | null, from?: string, to?: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const stamp = Date.parse(value),
    start = day(from),
    end = day(to);
  return (
    Number.isFinite(stamp) &&
    (start === null || stamp >= start) &&
    (end === null || stamp < end + 86400000)
  );
}
const normalized = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .trim()
    .toLocaleLowerCase('fa');
export function filterFinanceInbox(
  items: readonly FinanceInboxItemV1[],
  query: FinanceInboxQueryV1,
) {
  return items
    .filter((item) => {
      const amount = item.amount ? decimalUnits(item.amount.amount) : null;
      const status =
        !query.status ||
        (query.status === 'OPEN'
          ? !isClosedFinanceItem(item)
          : query.status === 'CLOSED'
            ? isClosedFinanceItem(item)
            : item.status === query.status);
      return (
        status &&
        (!query.source || item.source === query.source) &&
        (!query.branchId || item.branchReference === query.branchId) &&
        (!query.currencyCode ||
          item.amount?.currencyCode === query.currencyCode) &&
        (!query.person ||
          normalized(
            [item.partyDisplaySnapshot, item.requesterDisplaySnapshot].join(
              ' ',
            ),
          ).includes(normalized(query.person))) &&
        (!query.search ||
          normalized(
            [
              item.title,
              item.description,
              item.sourceReference,
              item.contractReference,
              item.partyDisplaySnapshot,
              item.requesterDisplaySnapshot,
            ].join(' '),
          ).includes(normalized(query.search))) &&
        (!query.minAmount ||
          (amount !== null && amount >= decimalUnits(query.minAmount))) &&
        (!query.maxAmount ||
          (amount !== null && amount <= decimalUnits(query.maxAmount))) &&
        inDays(item.createdAt, query.fromDate, query.toDate) &&
        inDays(item.dueAt, query.dueFrom, query.dueTo)
      );
    })
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
}
