import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceInboxItemV1,
  FinanceInboxPageV1,
  FinanceInboxQueryV1,
} from '@nora/contracts';

export const CLOSED_FINANCE_STATUSES = new Set([
  'CLOSED',
  'APPROVED',
  'PAID',
  'RECEIPT_CONFIRMED',
  'RECEIPT_VOIDED',
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
  'RECEIPT_VOIDED',
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
/** Reservation purchases are ready on handoff, before any Finance decision. */
export function isFinanceApproved(item: FinanceInboxItemV1) {
  if (item.source === 'RESERVATIONS' && item.status === 'READY_FOR_PAYMENT')
    return false;
  return [
    'APPROVED',
    'READY_FOR_PAYMENT',
    'PAYING',
    'PAID',
    'RECEIPT_CONFIRMED',
    'RECEIPT_VOIDED',
  ].includes(item.status);
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
    'approvalGroup',
    'category',
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
    'sortBy',
    'sortDirection',
  ] as const)
    if (query[key] !== undefined && typeof query[key] !== 'string')
      throw new BadRequestException('نوع فیلتر معتبر نیست.');
  if (query.branchId && !actor.branchIds.includes(query.branchId))
    throw new ForbiddenException('شعبه خارج از دسترسی است.');
  if (
    (query.approvalGroup &&
      !['PENDING', 'APPROVED'].includes(query.approvalGroup)) ||
    (query.category && !['PURCHASE', 'RECEIPT'].includes(query.category)) ||
    (query.sortBy &&
      !['createdAt', 'dueAt', 'amount'].includes(query.sortBy)) ||
    (query.sortDirection && !['asc', 'desc'].includes(query.sortDirection)) ||
    (query.source &&
      !['SALES', 'HR', 'RESERVATIONS', 'PURCHASES', 'FINANCE'].includes(
        query.source,
      )) ||
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
function inDays(
  value: string | null,
  start: number | null,
  end: number | null,
) {
  if (start === null && end === null) return true;
  if (!value) return false;
  const stamp = Date.parse(value);
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
function financeInboxPredicate(query: FinanceInboxQueryV1) {
  const min = query.minAmount ? decimalUnits(query.minAmount) : null;
  const max = query.maxAmount ? decimalUnits(query.maxAmount) : null;
  const createdFrom = day(query.fromDate);
  const createdTo = day(query.toDate);
  const dueFrom = day(query.dueFrom);
  const dueTo = day(query.dueTo);
  const person = query.person && normalized(query.person);
  const search = query.search && normalized(query.search);
  return (item: FinanceInboxItemV1) => {
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
      (!query.approvalGroup ||
        (query.approvalGroup === 'APPROVED') === isFinanceApproved(item)) &&
      (!query.category ||
        (query.category === 'RECEIPT'
          ? item.kind === 'RECEIPT_VERIFICATION'
          : item.kind === 'PAYMENT_REQUEST' &&
            ['RESERVATIONS', 'PURCHASES'].includes(item.source))) &&
      (!query.source || item.source === query.source) &&
      (!query.branchId || item.branchReference === query.branchId) &&
      (!query.currencyCode ||
        item.amount?.currencyCode === query.currencyCode) &&
      (!person ||
        normalized(
          [item.partyDisplaySnapshot, item.requesterDisplaySnapshot].join(' '),
        ).includes(person)) &&
      (!search ||
        normalized(
          [
            item.title,
            item.description,
            item.sourceReference,
            item.contractReference,
            item.partyDisplaySnapshot,
            item.requesterDisplaySnapshot,
          ].join(' '),
        ).includes(search)) &&
      (min === null || (amount !== null && amount >= min)) &&
      (max === null || (amount !== null && amount <= max)) &&
      inDays(item.createdAt, createdFrom, createdTo) &&
      inDays(item.dueAt, dueFrom, dueTo)
    );
  };
}

function financeInboxComparator(query: FinanceInboxQueryV1) {
  const field = query.sortBy ?? 'createdAt';
  const direction =
    (query.sortDirection ?? (field === 'dueAt' ? 'asc' : 'desc')) === 'asc'
      ? 1
      : -1;
  return (a: FinanceInboxItemV1, b: FinanceInboxItemV1) => {
    const left = field === 'amount' ? a.amount : a[field];
    const right = field === 'amount' ? b.amount : b[field];
    if (left === null || right === null) {
      if (left !== right) return left === null ? 1 : -1;
    } else if (field === 'amount') {
      // Different currencies have no common nominal monetary ordering.
      const currency = a.amount!.currencyCode.localeCompare(
        b.amount!.currencyCode,
      );
      if (currency) return currency;
      const leftUnits = decimalUnits(a.amount!.amount);
      const rightUnits = decimalUnits(b.amount!.amount);
      if (leftUnits !== rightUnits)
        return (leftUnits < rightUnits ? -1 : 1) * direction;
    } else {
      const difference =
        Date.parse(left as string) - Date.parse(right as string);
      if (difference) return Math.sign(difference) * direction;
    }
    return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  };
}

export function filterFinanceInbox(
  items: readonly FinanceInboxItemV1[],
  query: FinanceInboxQueryV1,
) {
  return items
    .filter(financeInboxPredicate(query))
    .sort(financeInboxComparator(query));
}

export function compareFinanceQueueOrder(
  a: FinanceInboxItemV1,
  b: FinanceInboxItemV1,
) {
  return (
    (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') ||
    b.createdAt.localeCompare(a.createdAt)
  );
}

type RankedItem = { item: FinanceInboxItemV1; index: number };

/** Keeps the worst retained row at the root so a better row can replace it. */
function retainFinanceRow(
  heap: RankedItem[],
  row: RankedItem,
  capacity: number,
  compare: (left: RankedItem, right: RankedItem) => number,
) {
  if (heap.length < capacity) {
    let index = heap.length;
    heap.push(row);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compare(heap[parent]!, row) >= 0) break;
      heap[index] = heap[parent]!;
      index = parent;
    }
    heap[index] = row;
    return;
  }
  if (compare(row, heap[0]!) >= 0) return;
  let index = 0;
  while (2 * index + 1 < heap.length) {
    let child = 2 * index + 1;
    if (child + 1 < heap.length && compare(heap[child + 1]!, heap[child]!) > 0)
      child++;
    if (compare(row, heap[child]!) >= 0) break;
    heap[index] = heap[child]!;
    index = child;
  }
  heap[index] = row;
}

export function selectFinanceInboxPage(
  items: readonly FinanceInboxItemV1[],
  query: FinanceInboxQueryV1,
  page: number,
  pageSize: number,
  generatedAt: string,
): Pick<FinanceInboxPageV1, 'items' | 'total' | 'summary'> {
  const matches = financeInboxPredicate(query);
  const compareItems = financeInboxComparator(query);
  const compare = (a: RankedItem, b: RankedItem) =>
    compareItems(a.item, b.item) ||
    compareFinanceQueueOrder(a.item, b.item) ||
    a.index - b.index;
  const capacity = page * pageSize;
  const heap: RankedItem[] = [];
  const summary = {
    openCount: 0,
    overdueCount: 0,
    receiptCount: 0,
    paymentCount: 0,
  };
  let total = 0;
  for (const [index, item] of items.entries()) {
    if (!matches(item)) continue;
    total++;
    retainFinanceRow(heap, { item, index }, capacity, compare);
    if (isClosedFinanceItem(item)) continue;
    summary.openCount++;
    if (item.dueAt && item.dueAt < generatedAt) summary.overdueCount++;
    if (item.source === 'SALES' || item.direction === 'RECEIPT')
      summary.receiptCount++;
    if (
      ['PAYMENT_REQUEST', 'PAYROLL_REQUEST', 'OPERATIONAL_REQUEST'].includes(
        item.kind,
      ) &&
      item.amount &&
      item.direction !== 'RECEIPT' &&
      item.direction !== 'NON_CASH' &&
      ['READY_FOR_PAYMENT', 'APPROVED', 'PAYING'].includes(item.status)
    )
      summary.paymentCount++;
  }
  const start = (page - 1) * pageSize;
  return {
    items:
      total > start
        ? heap
            .sort(compare)
            .slice(start)
            .map(({ item }) => item)
        : [],
    total,
    summary,
  };
}
