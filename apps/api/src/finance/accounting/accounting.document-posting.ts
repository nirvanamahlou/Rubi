import { createHash } from 'node:crypto';
import { Prisma } from '@nora/database';
import * as v from './accounting.validation';
import { documentFigureStatuses } from './accounting.document-figures';

/** The interval starts after the last final document; callers cannot choose it. */
export async function documentPostingInterval(
  tx: Prisma.TransactionClient,
  book: { id: string; baseCurrency: string },
  payload: Record<string, unknown>,
) {
  const toDate = v.date(payload.toDate)!;
  const periods = await tx.accountingPeriod.findMany({
    where: {
      bookId: book.id,
      status: 'OPEN',
      startDate: { lte: toDate },
      endDate: { gte: toDate },
    },
  });
  if (periods.length !== 1)
    v.rule('تا تاریخ باید در یک دوره مالی باز این دفتر باشد.');
  const period = periods[0]!;
  const last = await tx.accountingJournal.findFirst({
    where: { bookId: book.id, periodId: period.id, status: 'POSTED' },
    orderBy: { documentDate: 'desc' },
  });
  const fromDate = last?.documentDate
    ? new Date(new Date(`${last.documentDate}T00:00:00Z`).getTime() + 86400000)
        .toISOString()
        .slice(0, 10)
    : period.startDate;
  if (toDate < fromDate)
    v.rule('بازه قطعی‌کردن بعد از آخرین سند قطعی آغاز می‌شود.');
  return { period, fromDate, toDate };
}

export async function documentPostingPreview(
  tx: Prisma.TransactionClient,
  book: { id: string; baseCurrency: string },
  payload: Record<string, unknown>,
) {
  const { period, fromDate, toDate } = await documentPostingInterval(
    tx,
    book,
    payload,
  );
  const rows = await tx.accountingJournal.findMany({
    where: {
      bookId: book.id,
      periodId: period.id,
      documentDate: { gte: fromDate, lte: toDate },
      status: { notIn: ['POSTED', 'CANCELLED'] },
    },
    include: { lines: { orderBy: { position: 'asc' } } },
    orderBy: [
      { documentDate: 'asc' },
      { number: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    take: 501,
  });
  if (rows.length > 500) v.rule('بازه را به حداکثر ۵۰۰ سند محدود کنید.');
  if (rows.some((row) => row.status !== 'APPROVED'))
    v.rule('همه اسناد این بازه باید ابتدا بررسی شوند.');
  const positions = await tx.$queryRaw<
    {
      code: string;
      currency: string;
      baseBalance: Prisma.Decimal;
      foreignBalance: Prisma.Decimal;
    }[]
  >(Prisma.sql`
    SELECT a.code,
      CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'REVERSE:%' OR j."sourceKey" LIKE 'WORKFLOW:%'
        THEN COALESCE(l.attributes->>'valuationCurrency',l.currency) ELSE l.currency END AS currency,
      SUM(l.debit-l.credit) AS "baseBalance",
      SUM(CASE WHEN l.currency<>${book.baseCurrency} THEN CASE WHEN l.debit>0 THEN COALESCE(l."foreignAmount",0) ELSE -COALESCE(l."foreignAmount",0) END ELSE 0 END) AS "foreignBalance"
    FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
    JOIN accounting_accounts a ON a.id=l."accountId" AND a."bookId"=j."bookId"
    WHERE j."bookId"=${book.id}::uuid AND j."periodId"=${period.id}::uuid AND j."documentDate"<=${toDate}
      AND ${documentFigureStatuses}
      AND (CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'REVERSE:%' OR j."sourceKey" LIKE 'WORKFLOW:%'
        THEN COALESCE(l.attributes->>'valuationCurrency',l.currency) ELSE l.currency END)<>${book.baseCurrency}
    GROUP BY 1,2,l."detail4Id",l."detail5Id",l."detail6Id"
    ORDER BY 1,2`);
  const warnings = [
    ...new Set(
      positions
        .filter(
          (row) =>
            row.baseBalance.comparedTo(0) !== row.foreignBalance.comparedTo(0),
        )
        .map(
          (row) =>
            `مانده ارز و مبلغ عملیاتی حساب ${row.code} برای ارز ${row.currency} تطابق ماهیت ندارند.`,
        ),
    ),
  ];
  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        periodId: period.id,
        fromDate,
        toDate,
        rows: rows.map((row) => [row.id, row.version]),
        warnings,
        positions,
      }),
    )
    .digest('hex');
  return { periodId: period.id, fromDate, toDate, rows, warnings, checksum };
}
