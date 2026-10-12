import { createHash } from 'node:crypto';
import type { Prisma } from '@nora/database';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

export async function generalDocumentPreview(
  tx: Prisma.TransactionClient,
  bookId: string,
  payload: Record<string, unknown>,
) {
  const periodId = v.uuid(payload.periodId)!;
  const period = await tx.accountingPeriod.findFirst({
    where: { id: periodId, bookId, status: 'OPEN' },
  });
  if (!period) v.rule('دوره مالی باز همین دفتر لازم است.');
  const method = String(payload.method || 'NONE');
  if (!['NONE', 'DAILY', 'MONTHLY'].includes(method))
    v.invalid('روش صدور سند کل معتبر نیست.');
  const filter = String(payload.filter || 'date');
  if (filter !== 'date')
    v.rule(
      'فیلتر شماره سند به تنظیم شماره‌گذاری در سطح کل شعب نیاز دارد؛ این تنظیم هنوز متصل نیست.',
    );
  const fromDate = v.date(payload.fromDate)!;
  const toDate = v.date(payload.toDate)!;
  if (
    fromDate > toDate ||
    fromDate < period.startDate ||
    toDate > period.endDate
  )
    v.rule('بازه تاریخ باید در دوره جاری باشد.');
  if (
    payload.separateYearEnd !== undefined &&
    typeof payload.separateYearEnd !== 'boolean'
  )
    v.invalid('گزینه تفکیک اسناد پایان سال معتبر نیست.');
  const separateYearEnd = payload.separateYearEnd === true;
  const rows = await tx.accountingJournal.findMany({
    where: {
      bookId,
      periodId,
      status: 'POSTED',
      documentDate: { gte: fromDate, lte: toDate },
      generalDocumentMember: null,
    },
    include: {
      type: true,
      lines: {
        orderBy: { position: 'asc' },
        include: { account: { include: { parent: true } } },
      },
    },
    orderBy: [{ documentDate: 'asc' }, { number: 'asc' }, { id: 'asc' }],
    take: 501,
  });
  if (rows.length > 500) v.rule('بازه را به حداکثر ۵۰۰ سند محدود کنید.');
  const groups = new Map<string, typeof rows>();
  const yearEndTitles = new Set([
    'تعدیل ماهیت انتهای دوره',
    'تعدیل ماهیت ابتدای دوره',
    'بستن حساب ها',
    'اختتامیه',
    'افتتاحیه',
  ]);
  for (const row of rows) {
    const date = row.documentDate!;
    const suffix =
      separateYearEnd && yearEndTitles.has(row.type?.title ?? '')
        ? `:${row.typeId}`
        : '';
    const key =
      (method === 'DAILY'
        ? date
        : method === 'MONTHLY'
          ? date.slice(0, 7)
          : 'all') + suffix;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const documents = [...groups.values()]
    .map((members) => {
      const totals = new Map<
        string,
        {
          accountId: string;
          code: string;
          title: string;
          debit: DecimalValue;
          credit: DecimalValue;
        }
      >();
      for (const row of members)
        for (const line of row.lines) {
          const account =
            line.account?.level === 'GENERAL'
              ? line.account
              : line.account?.parent;
          if (
            !account ||
            account.level !== 'GENERAL' ||
            account.bookId !== bookId
          )
            v.rule('حساب کل همه اقلام باید در ساختار همین دفتر مشخص باشد.');
          const current = totals.get(account.id) ?? {
            accountId: account.id,
            code: account.code,
            title: account.title,
            debit: DecimalValue.zero(),
            credit: DecimalValue.zero(),
          };
          current.debit = current.debit.add(
            DecimalValue.parse(line.debit.toString()),
          );
          current.credit = current.credit.add(
            DecimalValue.parse(line.credit.toString()),
          );
          totals.set(account.id, current);
        }
      const lines = [...totals.values()]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((line) => ({
          ...line,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
        }));
      const debit = lines.reduce(
        (sum, line) => sum.add(DecimalValue.parse(line.debit)),
        DecimalValue.zero(),
      );
      const credit = lines.reduce(
        (sum, line) => sum.add(DecimalValue.parse(line.credit)),
        DecimalValue.zero(),
      );
      if (debit.compare(credit) !== 0) v.rule('تجمیع سند کل باید تراز باشد.');
      return {
        documentDate: members.at(-1)!.documentDate!,
        journalIds: members.map((row) => row.id),
        amount: debit.toString(),
        lines,
      };
    })
    .sort((a, b) => a.documentDate.localeCompare(b.documentDate));
  const serial = await tx.accountingGeneralDocument.aggregate({
    where: { bookId, periodId },
    _max: { number: true },
  });
  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        periodId,
        periodVersion: period.version,
        method,
        filter,
        fromDate,
        toDate,
        separateYearEnd,
        rows: rows.map((row) => [row.id, row.version]),
        documents,
        serial: serial._max.number,
      }),
    )
    .digest('hex');
  return {
    periodId,
    method,
    fromDate,
    toDate,
    checksum,
    nextNumber: (serial._max.number ?? 0) + 1,
    items: rows.map((row) => ({
      id: row.id,
      number: row.number,
      documentDate: row.documentDate,
      description: row.description,
      reference: row.reference,
      attributes: row.attributes,
      typeId: row.typeId,
      makerId: row.makerId,
      version: row.version,
    })),
    documents,
  };
}
