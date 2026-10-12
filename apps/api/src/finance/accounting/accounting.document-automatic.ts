import { createHash } from 'node:crypto';
import { Prisma } from '@nora/database';
import type { AccountingLineV1 } from '@nora/contracts';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';
import { documentFigureStatuses } from './accounting.document-figures';
import type { AccountingCurrencyReference } from './accounting.currency-directory';

export function automaticTransferPair(
  balance: string,
  percentage: string,
  digits: number,
  source: Pick<
    AccountingLineV1,
    'accountId' | 'detail4Id' | 'detail5Id' | 'detail6Id'
  >,
  target: Pick<
    AccountingLineV1,
    'accountId' | 'detail4Id' | 'detail5Id' | 'detail6Id'
  >,
  description: string,
): AccountingLineV1[] {
  const percent = DecimalValue.parse(percentage);
  if (
    percent.compare(DecimalValue.parse('1')) < 0 ||
    percent.compare(DecimalValue.parse('100')) > 0
  )
    v.invalid('درصد مقصد باید بین یک و صد باشد.');
  if (!Number.isInteger(digits) || digits < 0 || digits > 6)
    v.invalid('دقت اعشار ارز معتبر نیست.');
  const signed = DecimalValue.parse(balance)
    .multiply(DecimalValue.parse(percentage))
    .multiply(DecimalValue.parse('0.01'))
    .round(digits, 'HALF_UP');
  if (signed.isZero) return [];
  const amount = signed.isNegative
    ? DecimalValue.zero().subtract(signed).toString()
    : signed.toString();
  return [
    {
      ...source,
      description,
      debit: signed.isNegative ? amount : '0',
      credit: signed.isNegative ? '0' : amount,
      currency: null,
      rate: null,
      foreignAmount: null,
      attributes: {},
    },
    {
      ...target,
      description,
      debit: signed.isNegative ? '0' : amount,
      credit: signed.isNegative ? amount : '0',
      currency: null,
      rate: null,
      foreignAmount: null,
      attributes: {},
    },
  ];
}

/** Each destination owns its source criteria. Empty destination details inherit actual source dimensions. */
export async function automaticDocumentPreview(
  tx: Prisma.TransactionClient,
  book: { id: string; baseCurrency: string },
  payload: Record<string, unknown>,
  currencies: readonly AccountingCurrencyReference[],
) {
  const templateId = v.uuid(payload.templateId)!;
  const template = await tx.accountingTemplate.findFirst({
    where: { id: templateId, bookId: book.id, kind: 'AUTOMATIC', active: true },
    include: { lines: { orderBy: { position: 'asc' } } },
  });
  if (
    !template ||
    v.attributes(template.attributes).sourceForm !== 'rahkaran-documents-v1'
  )
    v.rule('الگوی فعال سند اتوماتیک این دفتر را انتخاب کنید.');
  const documentDate = v.date(payload.documentDate)!;
  const asOf = v.date(payload.asOf)!;
  const periods = await tx.accountingPeriod.findMany({
    where: {
      bookId: book.id,
      status: 'OPEN',
      startDate: { lte: documentDate },
      endDate: { gte: documentDate },
    },
  });
  if (periods.length !== 1)
    v.rule('تاریخ سند باید داخل یک دوره مالی باز باشد.');
  const period = periods[0]!;
  if (asOf < period.startDate || asOf > period.endDate)
    v.rule('تا تاریخ باید در دوره مالی سند باشد.');
  const description = v.text(payload.description, 2000, true);
  const attributes = {
    auxiliaryNumber: v.text(payload.auxiliaryNumber, 40),
    descriptionEn: v.text(payload.descriptionEn, 2000),
  };
  const trackingNumber = v.text(payload.trackingNumber, 100);
  const trackingDate = v.date(payload.trackingDate, true);
  const typeId = v.uuid(payload.typeId)!;
  if (
    !(await tx.accountingConfiguration.findFirst({
      where: {
        id: typeId,
        bookId: book.id,
        kind: 'voucher-types',
        active: true,
      },
    }))
  )
    v.rule('نوع سند فعال این دفتر لازم است.');
  const currency = currencies.find((item) => item.code === book.baseCurrency);
  if (
    !currency ||
    !Number.isInteger(currency.decimalDigits) ||
    currency.decimalDigits < 0 ||
    currency.decimalDigits > 6
  )
    v.rule('دقت اعشار ارز عملیاتی در اطلاعات پایه تعریف شود.');
  let assignments: Record<string, number>;
  try {
    assignments = v.object(
      JSON.parse(String(v.attributes(template.attributes).sourceAssignments)),
    ) as Record<string, number>;
  } catch {
    v.rule('تخصیص مبداهای الگو معتبر نیست.');
  }
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
    v.rule('همه معین‌های الگو باید فعال و متعلق به همین دفتر باشند.');
  if (
    accounts.some(
      (account) => v.attributes(account.attributes).multiCurrency === true,
    )
  )
    v.rule(
      'صدور سند اتوماتیک با حساب ارزی به تنظیم امکان نرخ دستی نیاز دارد؛ این تنظیم هنوز پشتیبانی نشده است.',
    );
  const lines: AccountingLineV1[] = [];
  const basis: unknown[] = [];
  for (const source of template.lines.filter(
    (line) => line.role === 'SOURCE',
  )) {
    const target = template.lines.find(
      (line) =>
        line.position === assignments[String(source.position)] &&
        line.role === 'TARGET',
    );
    if (!target) v.rule('مقصد هر حساب مبدا باید مشخص باشد.');
    const clauses = [
      Prisma.sql`j."bookId"=${book.id}::uuid AND j."periodId"=${period.id}::uuid AND j."documentDate"<=${asOf}`,
      Prisma.sql`l."accountId"=${source.accountId}::uuid`,
      documentFigureStatuses,
    ];
    for (const level of [4, 5, 6] as const) {
      const detailId = source[`detail${level}Id`];
      if (detailId)
        clauses.push(
          Prisma.sql`${Prisma.raw(`l."detail${level}Id"`)}=${detailId}::uuid`,
        );
    }
    const balances = await tx.$queryRaw<
      {
        detail4Id: string | null;
        detail5Id: string | null;
        detail6Id: string | null;
        currency: string | null;
        balance: Prisma.Decimal;
      }[]
    >(Prisma.sql`
      SELECT l."detail4Id",l."detail5Id",l."detail6Id",l.currency,SUM(l.debit-l.credit) AS balance
      FROM accounting_journal_lines l JOIN accounting_journals j ON j.id=l."journalId"
      WHERE ${Prisma.join(
        clauses.map((clause) => Prisma.sql`(${clause})`),
        ' AND ',
      )}
      GROUP BY l."detail4Id",l."detail5Id",l."detail6Id",l.currency
      ORDER BY l."detail4Id",l."detail5Id",l."detail6Id",l.currency`);
    basis.push([source.position, balances]);
    for (const balance of balances) {
      if (balance.currency && balance.currency !== book.baseCurrency)
        v.rule('مانده ارزی برای حساب غیرارزی قابل انتقال نیست.');
      const origin = {
        accountId: source.accountId,
        detail4Id: balance.detail4Id,
        detail5Id: balance.detail5Id,
        detail6Id: balance.detail6Id,
      };
      const destination = {
        accountId: target.accountId,
        detail4Id: target.detail4Id ?? balance.detail4Id,
        detail5Id: target.detail5Id ?? balance.detail5Id,
        detail6Id: target.detail6Id ?? balance.detail6Id,
      };
      if (JSON.stringify(origin) === JSON.stringify(destination))
        v.rule('مبدا و مقصد واقعی انتقال نمی‌توانند یکسان باشند.');
      for (const line of automaticTransferPair(
        balance.balance.toString(),
        target.percentage.toString(),
        currency.decimalDigits,
        origin,
        destination,
        description,
      )) {
        line.attributes = {
          descriptionEn: attributes.descriptionEn,
          trackingNumber,
          ...(trackingDate ? { trackingDate } : {}),
        };
        lines.push(line);
      }
    }
  }
  if (!lines.length) v.rule('مانده قابل انتقالی در مبداهای الگو وجود ندارد.');
  if (lines.length > 500)
    v.rule('الگو بیش از ۵۰۰ قلم ایجاد می‌کند؛ مبداهای الگو را محدود کنید.');
  const header = {
    periodId: period.id,
    documentDate,
    typeId,
    description,
    attributes,
  };
  const checksum = createHash('sha256')
    .update(
      JSON.stringify({
        template: [template.id, template.version],
        currency: [currency.id, currency.version, currency.decimalDigits],
        header,
        trackingNumber,
        trackingDate,
        basis,
        lines,
      }),
    )
    .digest('hex');
  return {
    ...header,
    lines,
    checksum,
    templateId: template.id,
    templateVersion: template.version,
    asOf,
  };
}
