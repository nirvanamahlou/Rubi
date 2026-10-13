import { Prisma } from '@nora/database';
import * as v from './accounting.validation';

/** Complete temporary source documents affect figures; incomplete legacy drafts do not. */
export const documentFigureStatuses = Prisma.sql`(j.status IN ('PENDING_APPROVAL','APPROVED','POSTED') OR (j.status='DRAFT' AND j.attributes->>'sourceForm'='rahkaran-documents-v1'))`;

export async function documentFigures(
  tx: Prisma.TransactionClient,
  book: { id: string; baseCurrency: string },
  kind: 'document-turnover' | 'document-fx-balance',
  query: Record<string, string>,
) {
  const accountId = v.uuid(query.accountId)!;
  const account = await tx.accountingAccount.findFirst({
    where: { id: accountId, bookId: book.id, level: 'SUBSIDIARY' },
  });
  if (!account) v.rule('حساب معین این دفتر را انتخاب کنید.');
  const clauses: Prisma.Sql[] = [
    Prisma.sql`j."bookId"=${book.id}::uuid`,
    Prisma.sql`l."accountId"=${accountId}::uuid`,
    documentFigureStatuses,
  ];
  const level = Number(query.level ?? '3');
  if (![3, 4, 5, 6].includes(level)) v.invalid('سطح گردش معتبر نیست.');
  for (const detailLevel of [4, 5, 6]) {
    if (detailLevel > level) break;
    const detailId = v.uuid(query[`detail${detailLevel}Id`])!;
    if (
      !(await tx.accountingDetail.findFirst({
        where: { id: detailId, bookId: book.id },
        select: { id: true },
      }))
    )
      v.rule('تفصیلی سطح انتخاب‌شده متعلق به این دفتر نیست.');
    clauses.push(
      Prisma.sql`${Prisma.raw(`l."detail${detailLevel}Id"`)}=${detailId}::uuid`,
    );
  }
  if (kind === 'document-turnover') {
    const periodId = v.uuid(query.periodId)!;
    const period = await tx.accountingPeriod.findFirst({
      where: { id: periodId, bookId: book.id },
    });
    if (!period) v.rule('دوره مالی این دفتر لازم است.');
    clauses.push(
      Prisma.sql`j."periodId"=${periodId}::uuid AND j."documentDate">=${period.startDate} AND j."documentDate"<=${period.endDate}`,
    );
    const where = Prisma.join(
      clauses.map((clause) => Prisma.sql`(${clause})`),
      ' AND ',
    );
    const page = Number(query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      v.invalid('صفحه معتبر نیست.');
    const rows = await tx.$queryRaw<
      {
        id: string;
        reference: string | null;
        number: number | null;
        documentDate: string;
        description: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        balance: Prisma.Decimal;
      }[]
    >(Prisma.sql`SELECT l.id,j.reference,j.number,j."documentDate",l.description,l.debit,l.credit,
      SUM(l.debit-l.credit) OVER (ORDER BY j."documentDate",j.number NULLS LAST,j."createdAt",j.id,l.position,l.id) AS balance
      FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
      WHERE ${where} ORDER BY j."documentDate",j.number NULLS LAST,j."createdAt",j.id,l.position,l.id
      LIMIT 50 OFFSET ${(page - 1) * 50}`);
    const sums = await tx.$queryRaw<
      {
        total: bigint;
        debit: Prisma.Decimal | null;
        credit: Prisma.Decimal | null;
        balance: Prisma.Decimal | null;
      }[]
    >(Prisma.sql`SELECT COUNT(*) AS total,SUM(l.debit) AS debit,SUM(l.credit) AS credit,SUM(l.debit-l.credit) AS balance
      FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId" WHERE ${where}`);
    const sum = sums[0]!;
    return {
      page,
      pageSize: 50,
      total: Number(sum.total),
      totals: {
        debit: sum.debit?.toString() ?? '0',
        credit: sum.credit?.toString() ?? '0',
        balance: sum.balance?.toString() ?? '0',
      },
      rows: rows.map((row) => ({
        ...row,
        debit: row.debit.toString(),
        credit: row.credit.toString(),
        balance: row.balance.toString(),
      })),
    };
  }
  if (v.attributes(account.attributes).multiCurrency !== true)
    v.rule('تراز ارزی برای حساب معین ارزی قابل مشاهده است.');
  const where = Prisma.join(
    clauses.map((clause) => Prisma.sql`(${clause})`),
    ' AND ',
  );
  const amount = Prisma.sql`CASE WHEN COALESCE(l.currency,${book.baseCurrency})=${book.baseCurrency} THEN l.debit+l.credit ELSE COALESCE(l."foreignAmount",0) END`;
  const rows = await tx.$queryRaw<
    {
      periodId: string;
      currency: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      balance: Prisma.Decimal;
    }[]
  >(Prisma.sql`SELECT j."periodId",COALESCE(l.currency,${book.baseCurrency}) AS currency,
    SUM(CASE WHEN l.debit>0 THEN ${amount} ELSE 0 END) AS debit,
    SUM(CASE WHEN l.credit>0 THEN ${amount} ELSE 0 END) AS credit,
    SUM(CASE WHEN l.debit>0 THEN ${amount} ELSE -${amount} END) AS balance
    FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
    WHERE ${where} GROUP BY 1,2
    ORDER BY j."periodId",currency`);
  return {
    rows: rows.map((row) => ({
      ...row,
      debit: row.debit.toString(),
      credit: row.credit.toString(),
      balance: row.balance.toString(),
    })),
  };
}
