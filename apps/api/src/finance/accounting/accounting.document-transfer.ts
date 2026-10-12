import { createHash } from 'node:crypto';
import { Prisma } from '@nora/database';
import type { AccountingLineV1, AuthenticatedActor } from '@nora/contracts';
import * as v from './accounting.validation';
import { DecimalValue } from '../finance.money';
import { documentSqlFilter } from './accounting.document-sql-filters';

const excludedTitles = [
  'تسعیر ارز',
  'تعدیل ماهیت انتهای دوره',
  'تعدیل ماهیت ابتدای دوره',
  'بستن حساب ها',
  'اختتامیه',
  'افتتاحیه',
];
export async function documentTransferPreview(
  tx: Prisma.TransactionClient,
  book: { id: string; isMain: boolean; baseCurrency: string },
  p: Record<string, unknown>,
  actor: AuthenticatedActor,
) {
  if (!book.isMain) v.rule('ارسال سند باید از دفتر کل اصلی انجام شود.');
  const period = await tx.accountingPeriod.findFirst({
    where: { id: v.uuid(p.periodId)!, bookId: book.id, status: 'OPEN' },
  });
  if (!period) v.rule('دوره مالی باز همین دفتر لازم است.');
  const where: Prisma.AccountingJournalWhereInput = {
    bookId: book.id,
    periodId: period.id,
    status: { in: ['APPROVED', 'POSTED'] },
    outgoingTransfers: { none: {} },
  };
  if (p.filterMode === 'date') {
    const from = v.date(p.fromDate)!,
      to = v.date(p.toDate)!;
    if (from > to || from < period.startDate || to > period.endDate)
      v.invalid('بازه تاریخ باید در دوره جاری باشد.');
    where.documentDate = { gte: from, lte: to };
  } else if (p.filterMode === 'number') {
    const from = Number(p.fromNumber),
      to = Number(p.toNumber);
    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to) ||
      from < 1 ||
      to < from
    )
      v.invalid('بازه شماره سند معتبر نیست.');
    where.number = { gte: from, lte: to };
  } else v.invalid('نوع فیلتر معتبر نیست.');
  if (p.ids !== undefined) {
    if (!Array.isArray(p.ids) || !p.ids.length || p.ids.length > 500)
      v.invalid('اسناد انتخابی معتبر نیستند.');
    where.id = { in: p.ids.map((id) => v.uuid(id)!) };
  }
  const clauses = [
    Prisma.sql`j."bookId"=${book.id}::uuid AND j."periodId"=${period.id}::uuid AND j.status IN ('APPROVED','POSTED')`,
    Prisma.sql`NOT EXISTS (SELECT 1 FROM accounting_journal_transfers t WHERE t."sourceJournalId"=j.id)`,
    Prisma.sql`NOT EXISTS (SELECT 1 FROM accounting_configurations c WHERE c.id=j."typeId" AND c.title IN (${Prisma.join(excludedTitles)}))`,
    Prisma.sql`(j."sourceKey" IS NULL OR (j."sourceKey" NOT LIKE 'REVALUE:%' AND j."sourceKey" NOT LIKE 'OPEN:%' AND j."sourceKey" NOT LIKE 'CLOSE:%'))`,
  ];
  if (p.filterMode === 'date')
    clauses.push(
      Prisma.sql`j."documentDate">=${v.date(p.fromDate)} AND j."documentDate"<=${v.date(p.toDate)}`,
    );
  else
    clauses.push(
      Prisma.sql`j.number>=${Number(p.fromNumber)} AND j.number<=${Number(p.toNumber)}`,
    );
  if (p.ids !== undefined)
    clauses.push(
      Prisma.sql`j.id IN (${Prisma.join((p.ids as string[]).map((id) => Prisma.sql`${id}::uuid`))})`,
    );
  if (p.filter !== undefined) clauses.push(documentSqlFilter(p.filter));
  const candidates = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT j.id FROM accounting_journals j WHERE ${Prisma.join(
      clauses.map((clause) => Prisma.sql`(${clause})`),
      ' AND ',
    )} ORDER BY j."documentDate",j.number,j.id LIMIT 501`,
  );
  const journals = await tx.accountingJournal.findMany({
    where: { ...where, id: { in: candidates.map((row) => row.id) } },
    include: {
      lines: { orderBy: { position: 'asc' } },
      type: true,
      outgoingTransfers: true,
    },
    orderBy: [{ documentDate: 'asc' }, { number: 'asc' }, { id: 'asc' }],
    take: 501,
  });
  if (journals.length > 500) v.rule('فیلتر را به حداکثر ۵۰۰ سند محدود کنید.');
  const mappings = await tx.accountingSubsidiaryMapping.findMany({
    where: { bookId: book.id },
    include: { targetAccount: { include: { book: true } } },
  });
  const docs: {
    sourceIds: string[];
    targetBookId: string;
    periodId: string;
    typeId: string;
    documentDate: string;
    description: string;
    lines: AccountingLineV1[];
  }[] = [];
  const eligible: typeof journals = [];
  for (const journal of journals) {
    const mapped = journal.lines.map((line) => {
      const matches = mappings
        .filter(
          (mapping) =>
            mapping.sourceAccountId === line.accountId &&
            [4, 5, 6].every(
              (n) =>
                !mapping[`sourceDetail${n}Id` as 'sourceDetail4Id'] ||
                mapping[`sourceDetail${n}Id` as 'sourceDetail4Id'] ===
                  line[`detail${n}Id` as 'detail4Id'],
            ),
        )
        .sort((a, b) =>
          [a, b]
            .map(
              (mapping) =>
                [4, 5, 6].filter(
                  (n) => mapping[`sourceDetail${n}Id` as 'sourceDetail4Id'],
                ).length,
            )
            .reduce((left, right) => right - left),
        );
      return matches[0];
    });
    if (!mapped.length || mapped.some((mapping) => !mapping)) continue;
    const target = mapped[0]!.targetAccount.book;
    if (mapped.some((mapping) => mapping!.targetAccount.bookId !== target.id))
      v.rule('معین‌های یک سند باید به یک دفتر فرعی نگاشت شده باشند.');
    if (
      journal.outgoingTransfers.some(
        (transfer) => transfer.targetBookId === target.id,
      )
    )
      continue;
    if (
      target.isMain ||
      !target.active ||
      !target.allowsPosting ||
      target.baseCurrency !== book.baseCurrency ||
      !actor.branchIds.includes(target.branchId)
    )
      v.rule('دفتر مقصد باید فرعی، فعال، مجاز و با ارز عملیاتی یکسان باشد.');
    const documentDate =
      p.dateMode === 'source'
        ? journal.documentDate!
        : p.dateMode === 'custom'
          ? v.date(p.documentDate)!
          : v.invalid('تاریخ اسناد ارسالی معتبر نیست.');
    const periods = await tx.accountingPeriod.findMany({
      where: {
        bookId: target.id,
        status: 'OPEN',
        startDate: { lte: documentDate },
        endDate: { gte: documentDate },
      },
    });
    if (periods.length !== 1)
      v.rule('تاریخ سند ارسالی باید در دوره باز دفتر فرعی باشد.');
    const types = await tx.accountingConfiguration.findMany({
      where: {
        bookId: target.id,
        kind: 'voucher-types',
        active: true,
        title: journal.type?.title ?? '',
      },
    });
    if (!journal.type || types.length !== 1)
      v.rule('نوع سند مبدا باید در دفتر مقصد تعریف شده باشد.');
    const lines: AccountingLineV1[] = [];
    for (const [position, line] of journal.lines.entries()) {
      const mapping = mapped[position]!;
      if (!mapping.targetAccount.active) v.rule('معین مقصد غیرفعال است.');
      const attrs = v.attributes(line.attributes);
      const rate =
        line.currency && line.currency !== book.baseCurrency
          ? await tx.accountingFxSnapshot.findFirst({
              where: {
                bookId: target.id,
                currency: line.currency,
                status: 'APPROVED',
                rate: line.rate!,
                validFrom: { lte: new Date() },
                validTo: { gte: new Date() },
                approverId: { not: null },
              },
              orderBy: { id: 'asc' },
            })
          : null;
      if (
        line.currency &&
        line.currency !== book.baseCurrency &&
        (!rate || rate.makerId === rate.approverId)
      )
        v.rule('نرخ معتبر برابر نرخ قلم مبدا در دفتر مقصد لازم است.');
      lines.push({
        accountId: mapping.targetAccountId,
        detail4Id: mapping.detail4Id,
        detail5Id: mapping.detail5Id,
        detail6Id: mapping.detail6Id,
        description: line.description,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
        currency: line.currency,
        rate: line.rate?.toString() ?? null,
        foreignAmount: line.foreignAmount?.toString() ?? null,
        fxSnapshotId: rate?.id ?? null,
        attributes: {
          descriptionEn: String(attrs.descriptionEn ?? ''),
          trackingNumber: String(attrs.trackingNumber ?? ''),
          ...(attrs.trackingDate
            ? { trackingDate: String(attrs.trackingDate) }
            : {}),
        },
      });
    }
    eligible.push(journal);
    docs.push({
      sourceIds: [journal.id],
      targetBookId: target.id,
      periodId: periods[0]!.id,
      typeId: types[0]!.id,
      documentDate,
      description: journal.description,
      lines,
    });
  }
  if (p.ids !== undefined && eligible.length !== (p.ids as unknown[]).length)
    v.rule('همه اسناد انتخابی باید همچنان قابل ارسال باشند.');
  if (p.aggregate === true && docs.length) {
    const first = docs[0]!;
    if (
      docs.some(
        (doc) =>
          doc.targetBookId !== first.targetBookId ||
          doc.typeId !== first.typeId ||
          doc.periodId !== first.periodId ||
          doc.documentDate !== first.documentDate,
      )
    )
      v.rule('ارسال تجمیعی به یک دفتر، نوع سند و تاریخ مشترک نیاز دارد.');
    const combined: AccountingLineV1[] = [];
    for (const line of docs.flatMap((doc) => doc.lines)) {
      const { debit, credit, ...identity } = line;
      const existing = combined.find((item) => {
        const { debit: unusedDebit, credit: unusedCredit, ...key } = item;
        void unusedDebit;
        void unusedCredit;
        return (
          JSON.stringify(key) === JSON.stringify(identity) &&
          DecimalValue.parse(item.debit).isZero ===
            DecimalValue.parse(debit).isZero
        );
      });
      if (existing) {
        existing.debit = DecimalValue.parse(existing.debit)
          .add(DecimalValue.parse(debit))
          .toString();
        existing.credit = DecimalValue.parse(existing.credit)
          .add(DecimalValue.parse(credit))
          .toString();
      } else combined.push({ ...line });
    }
    // Currency quantities need a source-observed consolidation policy before aggregation.
    if (combined.some((line) => line.currency))
      v.rule('تجمیع اقلام ارزی تا تعیین روش تجمیع مقدار ارز پشتیبانی نمی‌شود.');
    docs.splice(0, docs.length, {
      ...first,
      sourceIds: eligible.map((journal) => journal.id),
      description: eligible.map((journal) => journal.description).join('\n'),
      lines: combined,
    });
  }
  if (
    docs.some((doc) => doc.lines.length > 500 || doc.description.length > 2000)
  )
    v.rule('حجم سند ارسالی بیش از حد مجاز است.');
  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        period: [period.id, period.version],
        selection: {
          filterMode: p.filterMode,
          fromDate: p.fromDate,
          toDate: p.toDate,
          fromNumber: p.fromNumber,
          toNumber: p.toNumber,
          ids: p.ids,
          dateMode: p.dateMode,
          documentDate: p.documentDate,
          aggregate: p.aggregate,
        },
        journals: eligible.map((journal) => [journal.id, journal.version]),
        mappings: mappings.map((mapping) => [
          mapping.id,
          mapping.version,
          mapping.targetAccount.version,
          mapping.targetAccount.book.version,
        ]),
        docs,
      }),
    )
    .digest('hex');
  return {
    items: eligible.map(({ outgoingTransfers, type, ...journal }) => {
      void outgoingTransfers;
      return {
        ...journal,
        lines: journal.lines.map((line) => ({
          ...line,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
          rate: line.rate?.toString() ?? null,
          foreignAmount: line.foreignAmount?.toString() ?? null,
        })),
        typeTitle: type?.title ?? '',
      };
    }),
    documents: docs,
    checksum,
  };
}
