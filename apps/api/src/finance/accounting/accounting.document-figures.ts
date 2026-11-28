import { accountingDetailLevels } from '@nora/contracts';
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
  if (![3, ...accountingDetailLevels].includes(level))
    v.invalid('سطح گردش معتبر نیست.');
  for (const detailLevel of accountingDetailLevels) {
    if (detailLevel > level) break;
    const detailId = v.uuid(
      query[`detail${detailLevel}Id`],
      detailLevel !== level,
    );
    if (!detailId) continue;
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
    const exporting = query.export === 'true';
    const pageSize = exporting ? 10000 : 50;
    const page = exporting ? 1 : Number(query.page ?? 1);
    const search = v.text(query.search, 160);
    // Filter the displayed movement after calculating the running account balance.
    const movements = Prisma.sql`WITH movements AS (
      SELECT l.id, j.id AS "journalId", l.position, j.reference, j.number, j."documentDate",
        l.description, l.debit, l.credit,
        ROW_NUMBER() OVER w AS ordinal, SUM(l.debit-l.credit) OVER w AS balance
      FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
      WHERE ${where}
      WINDOW w AS (ORDER BY j."documentDate", j.number NULLS LAST, j."createdAt", j.id, l.position, l.id)
    )`;
    const filters: Prisma.Sql[] = [];
    if (search) {
      const numeric = search
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      filters.push(Prisma.sql`(strpos(description,${search})>0 OR strpos(reference,${search})>0
        OR strpos(reference,${numeric})>0 OR number::text=${numeric} OR "documentDate"=${numeric})`);
    }
    if (query.documentDate)
      filters.push(Prisma.sql`"documentDate"=${v.date(query.documentDate)!}`);
    const matching = filters.length
      ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
      : Prisma.empty;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      v.invalid('صفحه معتبر نیست.');
    const rows = await tx.$queryRaw<
      {
        id: string;
        journalId: string;
        position: number;
        reference: string | null;
        number: number | null;
        documentDate: string;
        description: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
        balance: Prisma.Decimal;
      }[]
    >(Prisma.sql`${movements} SELECT id,"journalId",position,reference,number,"documentDate",description,debit,credit,balance
      FROM movements ${matching} ORDER BY ordinal LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
    const sums = await tx.$queryRaw<
      {
        total: bigint;
        debit: Prisma.Decimal | null;
        credit: Prisma.Decimal | null;
        balance: Prisma.Decimal | null;
      }[]
    >(
      Prisma.sql`${movements} SELECT COUNT(*) AS total,SUM(debit) AS debit,SUM(credit) AS credit,SUM(debit-credit) AS balance FROM movements ${matching}`,
    );
    const sum = sums[0]!;
    if (exporting && Number(sum.total) > pageSize)
      v.rule('برای خروجی، محدوده گردش حساب را کوچک‌تر کنید.');
    return {
      page,
      pageSize,
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
  const periodScope = query.periodId
    ? Prisma.sql` AND j."periodId"=${v.uuid(query.periodId)!}::uuid`
    : Prisma.empty;
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
    WHERE ${where} ${periodScope} GROUP BY 1,2
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
