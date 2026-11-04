import { createHash } from 'node:crypto';
import { Prisma } from '@nora/database';
import type { AccountingLineV1 } from '@nora/contracts';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';
import { documentFigureStatuses } from './accounting.document-figures';

import type { AccountingCurrencyReference } from './accounting.currency-directory';

export async function sourceRevaluationPreview(
  tx: Prisma.TransactionClient,
  book: { id: string; baseCurrency: string },
  payload: Record<string, unknown>,
  currencies: readonly AccountingCurrencyReference[],
  excludeJournalId?: string,
) {
  const templateId = v.uuid(payload.templateId)!;
  const template = await tx.accountingTemplate.findFirst({
    where: {
      id: templateId,
      bookId: book.id,
      kind: 'REVALUATION',
      active: true,
    },
    include: { lines: { orderBy: { position: 'asc' } } },
  });
  if (
    !template ||
    v.attributes(template.attributes).sourceForm !== 'rahkaran-documents-v1'
  )
    v.rule('الگوی تسعیر فعال همین دفتر لازم است.');
  const asOf = v.date(payload.asOf)!;
  const periods = await tx.accountingPeriod.findMany({
    where: {
      bookId: book.id,
      status: 'OPEN',
      startDate: { lte: asOf },
      endDate: { gte: asOf },
    },
  });
  if (periods.length !== 1) v.rule('تا تاریخ باید در دوره مالی باز باشد.');
  const period = periods[0]!;
  const currency = v.text(payload.currency, 3, true);
  if (currency === book.baseCurrency || !/^[A-Z]{3}$/.test(currency))
    v.invalid('ارز تسعیر معتبر نیست.');
  const rate = await tx.accountingFxSnapshot.findFirst({
    where: {
      id: v.uuid(payload.rateId)!,
      bookId: book.id,
      currency,
      status: 'APPROVED',
    },
  });
  if (
    !rate ||
    !rate.approverId ||
    rate.makerId === rate.approverId ||
    rate.validFrom > new Date() ||
    rate.validTo < new Date()
  )
    v.rule('نرخ معتبر همان ارز لازم است.');
  const type = await tx.accountingConfiguration.findMany({
    where: {
      bookId: book.id,
      kind: 'voucher-types',
      title: 'تسعیر ارز',
      active: true,
    },
  });
  if (type.length !== 1) v.rule('نوع سند فعال تسعیر ارز این دفتر لازم است.');
  const currencyMaster = currencies.find((item) => item.code === currency);
  if (!currencyMaster) v.rule('ارز فعال در اطلاعات پایه لازم است.');
  const description =
    v.text(payload.description, 2000) ||
    `ثبت بابت سند تسعیر ارز ${currencyMaster.name}`;
  const descriptionEn =
    v.text(payload.descriptionEn, 2000) ||
    (currencyMaster.englishName
      ? `Conversion Voucher for ${currencyMaster.englishName}`
      : '');
  const baseCurrency = currencies.find(
    (item) => item.code === book.baseCurrency,
  );
  if (
    !baseCurrency ||
    !Number.isInteger(baseCurrency.decimalDigits) ||
    baseCurrency.decimalDigits < 0 ||
    baseCurrency.decimalDigits > 6
  )
    v.rule('دقت ارز عملیاتی باید در اطلاعات پایه مشخص باشد.');
  const accounts = await tx.accountingAccount.findMany({
    where: {
      bookId: book.id,
      id: { in: template.lines.map((line) => line.accountId!).filter(Boolean) },
    },
  });
  const byId = new Map(accounts.map((account) => [account.id, account]));
  if (
    template.lines.some(
      (line) =>
        !line.accountId ||
        !byId.get(line.accountId)?.active ||
        byId.get(line.accountId)?.level !== 'SUBSIDIARY',
    )
  )
    v.rule('همه معین‌های الگو باید فعال و در همین دفتر باشند.');
  let assignments: Record<string, number>;
  try {
    assignments = v.object(
      JSON.parse(String(v.attributes(template.attributes).sourceAssignments)),
    ) as Record<string, number>;
  } catch {
    v.rule('تخصیص حساب‌های مبنا معتبر نیست.');
  }
  const valuationCurrency = Prisma.sql`CASE WHEN j."sourceKey" LIKE 'REVALUE:%' OR j."sourceKey" LIKE 'OPEN:%' OR j."sourceKey" LIKE 'CLOSE:%' OR j."sourceKey" LIKE 'REVERSE:%' OR j."sourceKey" LIKE 'WORKFLOW:%' THEN COALESCE(l.attributes->>'valuationCurrency',l.currency) ELSE l.currency END`;
  const basis: unknown[] = [];
  const lines: AccountingLineV1[] = [];
  const changes: {
    accountId: string;
    detail4Id: string | null;
    detail5Id: string | null;
    detail6Id: string | null;
    quantity: string;
    base: string;
    difference: string;
  }[] = [];
  for (const source of template.lines.filter((line) => line.role === 'BASIS')) {
    const offset = template.lines.find(
      (line) =>
        line.role === 'OFFSET' &&
        line.position === assignments[String(source.position)],
    );
    if (!offset) v.rule('حساب طرف مقابل مبنای تسعیر لازم است.');
    if (
      v.attributes(byId.get(source.accountId!)!.attributes).revaluable !== true
    )
      v.rule('حساب مبنای تسعیر باید ویژگی تسعیرپذیر داشته باشد.');
    const sourceAccount = byId.get(source.accountId!)!;
    const lineDescription = `بابت تسعیر ارز حساب معین ${sourceAccount.code} ${currencyMaster.name} با نرخ ${rate.rate.toString()}`;
    const lineDescriptionEn = currencyMaster.englishName
      ? `Conversion Voucher for Subsidiary account number ${sourceAccount.code} ${currencyMaster.englishName} in ${rate.rate.toString()} rate`
      : '';
    const clauses = [
      Prisma.sql`j."bookId"=${book.id}::uuid AND j."periodId"=${period.id}::uuid AND j."documentDate"<=${asOf}`,
      Prisma.sql`l."accountId"=${source.accountId}::uuid`,
      Prisma.sql`${valuationCurrency}=${currency}`,
      documentFigureStatuses,
    ];
    if (excludeJournalId)
      clauses.push(Prisma.sql`j.id<>${excludeJournalId}::uuid`);
    for (const level of [4, 5, 6] as const)
      if (source[`detail${level}Id`])
        clauses.push(
          Prisma.sql`${Prisma.raw(`l."detail${level}Id"`)}=${source[`detail${level}Id`]}::uuid`,
        );
    const positions = await tx.$queryRaw<
      {
        detail4Id: string | null;
        detail5Id: string | null;
        detail6Id: string | null;
        quantity: Prisma.Decimal;
        base: Prisma.Decimal;
      }[]
    >(Prisma.sql`
      SELECT l."detail4Id",l."detail5Id",l."detail6Id",
        SUM(CASE WHEN l.currency=${currency} THEN CASE WHEN l.debit>0 THEN COALESCE(l."foreignAmount",0) ELSE -COALESCE(l."foreignAmount",0) END ELSE 0 END) AS quantity,
        SUM(l.debit-l.credit) AS base
      FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
      WHERE ${Prisma.join(
        clauses.map((clause) => Prisma.sql`(${clause})`),
        ' AND ',
      )}
      GROUP BY 1,2,3 ORDER BY 1,2,3`);
    basis.push([source.position, positions]);
    for (const position of positions) {
      const quantity = DecimalValue.parse(position.quantity.toString());
      const base = DecimalValue.parse(position.base.toString());
      const revised = quantity
        .multiply(DecimalValue.parse(rate.rate.toString()))
        .round(baseCurrency.decimalDigits, 'HALF_UP');
      const delta = revised.subtract(base);
      changes.push({
        accountId: source.accountId!,
        detail4Id: position.detail4Id,
        detail5Id: position.detail5Id,
        detail6Id: position.detail6Id,
        quantity: quantity.toString(),
        base: base.toString(),
        difference: delta.toString(),
      });
      if (delta.isZero) continue;
      const amount = (
        delta.isNegative ? DecimalValue.zero().subtract(delta) : delta
      ).toString();
      lines.push({
        accountId: source.accountId,
        detail4Id: position.detail4Id,
        detail5Id: position.detail5Id,
        detail6Id: position.detail6Id,
        description: lineDescription,
        debit: delta.isNegative ? '0' : amount,
        credit: delta.isNegative ? amount : '0',
        currency: null,
        foreignAmount: null,
        rate: null,
        fxSnapshotId: rate.id,
        attributes: {
          valuationCurrency: currency,
          descriptionEn: lineDescriptionEn,
        },
      });
      const offsetAttrs = v.attributes(byId.get(offset.accountId!)!.attributes);
      const inheritedDetail = (level: 4 | 5 | 6) =>
        offset[`detail${level}Id`] ??
        (offsetAttrs[`detail${level}TypeId`] ||
        (Array.isArray(offsetAttrs[`detail${level}TypeIds`]) &&
          (offsetAttrs[`detail${level}TypeIds`] as string[]).length)
          ? position[`detail${level}Id`]
          : null);
      lines.push({
        accountId: offset.accountId,
        detail4Id: inheritedDetail(4),
        detail5Id: inheritedDetail(5),
        detail6Id: inheritedDetail(6),
        description: lineDescription,
        debit: delta.isNegative ? amount : '0',
        credit: delta.isNegative ? '0' : amount,
        currency: null,
        foreignAmount: null,
        rate: null,
        fxSnapshotId: null,
        attributes: { descriptionEn: lineDescriptionEn },
      });
    }
  }
  if (lines.length > 500) v.rule('تعداد اقلام تسعیر بیش از حد مجاز است.');
  const attributes = {
    auxiliaryNumber: v.text(payload.auxiliaryNumber, 40),
    descriptionEn,
    revaluationTemplateId: template.id,
    revaluationTemplateVersion: String(template.version),
    revaluationCurrency: currency,
    revaluationRateId: rate.id,
  };
  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        templateId,
        templateVersion: template.version,
        periodId: period.id,
        periodVersion: period.version,
        asOf,
        currency,
        rate: [rate.id, rate.rate.toString(), rate.validFrom, rate.validTo],
        digits: baseCurrency.decimalDigits,
        description,
        attributes,
        basis,
        lines,
      }),
    )
    .digest('hex');
  return {
    periodId: period.id,
    typeId: type[0]!.id,
    asOf,
    description,
    attributes,
    checksum,
    lines,
    changes,
  };
}
