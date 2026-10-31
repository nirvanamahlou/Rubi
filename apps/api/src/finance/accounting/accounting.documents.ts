import type { Prisma } from '@nora/database';
import * as v from './accounting.validation';
import { journalFilter } from './accounting.document-filters';

/** Source rows belong to the selected destination/offset, never to all heads. */
export function validateTemplateAssignments(input: unknown[], kind: string) {
  const rows = input.map(v.object);
  const parentRole = kind === 'AUTOMATIC' ? 'TARGET' : 'OFFSET';
  const childRole = kind === 'AUTOMATIC' ? 'SOURCE' : 'BASIS';
  const parents = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.role === parentRole);
  if (!parents.length) v.rule('حداقل یک حساب مقصد یا تسعیر لازم است.');
  const assignments: Record<string, number> = {};
  const key = (row: Record<string, unknown>) =>
    [
      row.accountId,
      row.detail4Id ?? '',
      row.detail5Id ?? '',
      row.detail6Id ?? '',
    ].join(':');
  const parentKeys = new Set(parents.map(({ row }) => key(row)));
  if (parentKeys.size !== parents.length)
    v.rule('حساب مقصد یا تسعیر تکراری است.');
  const childKeys = new Set<string>();
  for (const [position, row] of rows.entries()) {
    if (row.role === parentRole) {
      if (row.parentPosition !== undefined && row.parentPosition !== null)
        v.invalid('حساب مقصد نمی‌تواند مبدا حساب دیگری باشد.');
      if (kind === 'AUTOMATIC' && Number(row.percentage) < 1)
        v.invalid('درصد مقصد باید بین یک و صد باشد.');
      continue;
    }
    if (row.role !== childRole) v.invalid('نقش ردیف الگو معتبر نیست.');
    const parent = row.parentPosition;
    if (
      typeof parent !== 'number' ||
      !Number.isSafeInteger(parent) ||
      parent < 0 ||
      rows[parent]?.role !== parentRole
    )
      v.invalid('حساب مقصد یا تسعیر ردیف مبدا مشخص نیست.');
    const identity = `${parent}:${key(row)}`;
    if (childKeys.has(identity)) v.rule('حساب مبدا این مقصد تکراری است.');
    if (kind === 'AUTOMATIC' && parentKeys.has(key(row)))
      v.rule('یک حساب نمی‌تواند هم مبدا و هم مقصد باشد.');
    childKeys.add(identity);
    assignments[String(position)] = parent as number;
  }
  for (const { index } of parents)
    if (!Object.values(assignments).includes(index))
      v.rule('برای هر حساب مقصد یا تسعیر حداقل یک حساب مبدا لازم است.');
  return assignments;
}

export function compareDocumentOrder(
  a: {
    id: string;
    documentDate: string | null;
    createdAt: Date;
    attributes: unknown;
  },
  b: {
    id: string;
    documentDate: string | null;
    createdAt: Date;
    attributes: unknown;
  },
) {
  const dateOrder = (a.documentDate ?? '').localeCompare(b.documentDate ?? '');
  if (dateOrder) return dateOrder;
  const daily = (value: unknown) => {
    const raw = v.attributes(value).dailyNumber;
    const number = Number(raw);
    return Number.isSafeInteger(number) && number > 0
      ? number
      : Number.MAX_SAFE_INTEGER;
  };
  return (
    daily(a.attributes) - daily(b.attributes) ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

/** Number only the reviewed preview, preserving all final journal numbers. */
export async function numberJournalPreview(
  tx: Prisma.TransactionClient,
  bookId: string,
  payload: Record<string, unknown>,
) {
  const periodId = v.uuid(payload.periodId)!;
  if (
    !(await tx.accountingPeriod.findFirst({
      where: { id: periodId, bookId, status: 'OPEN' },
    }))
  )
    v.rule('شماره‌گذاری به دوره مالی باز همین دفتر نیاز دارد.');
  if (
    !Array.isArray(payload.items) ||
    !payload.items.length ||
    payload.items.length > 500
  )
    v.invalid('فهرست شماره‌گذاری معتبر نیست.');
  const items = payload.items.map((item) => {
    const input = v.object(item);
    const id = v.uuid(input.id)!;
    const version = Number(input.expectedVersion);
    if (!Number.isSafeInteger(version) || version < 1)
      v.invalid('نسخه سند معتبر نیست.');
    return { id, version };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    v.invalid('سند تکراری در شماره‌گذاری وجود دارد.');
  const rows = await tx.accountingJournal.findMany({
    where: {
      bookId,
      periodId,
      status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
      // A filtered grid submits an explicit selection. Book, period, status and
      // per-row version guards still apply; unselected numbers are preserved.
      ...(payload.selectedOnly === true
        ? { id: { in: items.map((item) => item.id) } }
        : {}),
      ...(payload.filter ? { AND: [journalFilter(payload.filter)] } : {}),
    },
    take: 501,
  });
  if (rows.length > 500 || rows.length !== items.length)
    v.rule('فهرست شماره‌گذاری تغییر کرده است؛ دوباره پیش‌نمایش را بخوانید.');
  const versions = new Map(items.map((item) => [item.id, item.version]));
  for (const row of rows) {
    if (versions.get(row.id) !== row.version)
      v.rule('نسخه سند تغییر کرده است.');
    if (
      !row.documentDate ||
      !row.periodId ||
      !(await tx.accountingPeriod.findFirst({
        where: { id: row.periodId, bookId, status: 'OPEN' },
      }))
    )
      v.rule('شماره‌گذاری فقط برای سند تاریخ‌دار در دوره باز مجاز است.');
  }
  const ordered = rows.sort(compareDocumentOrder);
  const last = await tx.accountingJournal.aggregate({
    where: { bookId, periodId, id: { notIn: items.map((item) => item.id) } },
    _max: { number: true },
  });
  const start = (last._max.number ?? 0) + 1;
  if (start + ordered.length > 2000000000) v.rule('ظرفیت شماره سند کافی نیست.');
  await tx.accountingJournal.updateMany({
    where: { bookId, id: { in: items.map((item) => item.id) } },
    data: { number: null },
  });
  for (const [index, row] of ordered.entries())
    await tx.accountingJournal.update({
      where: { id: row.id },
      data: { number: start + index, version: { increment: 1 } },
    });
  const book = await tx.accountingBook.findUniqueOrThrow({
    where: { id: bookId },
  });
  await tx.accountingBook.update({
    where: { id: bookId },
    data: { nextNumber: Math.max(book.nextNumber, start + ordered.length) },
  });
  return {
    rows: ordered.map((row, index) => ({
      id: row.id,
      oldNumber: row.number,
      newNumber: start + index,
    })),
  };
}

/** Reorder the complete editable set for one date, without moving any date/period. */
export async function reorderJournals(
  tx: Prisma.TransactionClient,
  bookId: string,
  payload: Record<string, unknown>,
) {
  const documentDate = v.date(payload.documentDate)!;
  if (
    !Array.isArray(payload.items) ||
    !payload.items.length ||
    payload.items.length > 500
  )
    v.invalid('فهرست ترتیب اسناد معتبر نیست.');
  const items = (payload.items as unknown[]).map((value) => {
    const row = v.object(value);
    const id = v.uuid(row.id)!;
    const version = Number(row.expectedVersion);
    if (!Number.isSafeInteger(version) || version < 1)
      v.invalid('نسخه سند معتبر نیست.');
    return { id, version };
  });
  if (new Set(items.map((row) => row.id)).size !== items.length)
    v.invalid('سند تکراری در ترتیب وجود دارد.');
  const journals = await tx.accountingJournal.findMany({
    where: { bookId, documentDate, status: 'APPROVED' },
    take: 501,
  });
  if (journals.length !== items.length || journals.length > 500)
    v.rule('فهرست اسناد تاریخ تغییر کرده است؛ دوباره جستجو کنید.');
  const byId = new Map(journals.map((journal) => [journal.id, journal]));
  for (const item of items) {
    const journal = byId.get(item.id);
    if (!journal || journal.version !== item.version)
      v.rule('نسخه یا محدوده سند تغییر کرده است؛ دوباره جستجو کنید.');
    if (journal.status !== 'APPROVED')
      v.rule('جابجایی فقط برای اسناد بررسی‌شده مجاز است.');
    if (!journal.periodId) v.rule('دوره سند مشخص نیست.');
    const period = await tx.accountingPeriod.findFirst({
      where: { id: journal.periodId, bookId, status: 'OPEN' },
    });
    if (!period) v.rule('جابجایی فقط در دوره باز مجاز است.');
  }
  // The command dispatcher holds the book lock; versions guard a stale preview.
  for (const [position, item] of items.entries()) {
    const journal = byId.get(item.id)!;
    await tx.accountingJournal.update({
      where: { id: item.id },
      data: {
        attributes: {
          ...v.attributes(journal.attributes),
          dailyNumber: String(position + 1),
        },
        version: { increment: 1 },
      },
    });
  }
  return {
    documentDate,
    rows: items.map((item, position) => ({
      id: item.id,
      dailyNumber: position + 1,
    })),
  };
}
