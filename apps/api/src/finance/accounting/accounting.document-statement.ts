import { createHash } from 'node:crypto';
import type { Prisma } from '@nora/database';
import type { AccountingStatementBasisV1 } from '@nora/contracts';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

export async function documentStatementBasis(
  tx: Prisma.TransactionClient,
  book: { id: string; baseCurrency: string },
  input: Record<string, unknown>,
  currencies: { code: string; name: string }[],
): Promise<AccountingStatementBasisV1> {
  const journalId = v.uuid(input.journalId)!;
  const level = Number(input.level);
  if (![4, 5, 6].includes(level)) v.invalid('سطح اعلامیه معتبر نیست.');
  if (typeof input.currencyMode !== 'boolean')
    v.invalid('نوع اعلامیه معتبر نیست.');
  if (
    !Array.isArray(input.lineIds) ||
    !input.lineIds.length ||
    input.lineIds.length > 500
  )
    v.invalid('یک تا ۵۰۰ قلم سند را انتخاب کنید.');
  const lineIds = input.lineIds.map((id) => v.uuid(id)!);
  if (new Set(lineIds).size !== lineIds.length)
    v.invalid('قلم انتخاب‌شده تکراری است.');
  const journal = await tx.accountingJournal.findFirst({
    where: { id: journalId, bookId: book.id },
    include: { lines: { orderBy: { position: 'asc' } } },
  });
  if (
    !journal ||
    journal.status === 'MEMORANDUM' ||
    journal.status === 'CANCELLED' ||
    !journal.periodId ||
    !journal.documentDate ||
    !journal.number
  )
    v.rule('سند ذخیره‌شده و دارای اقلام مالی لازم است.');
  const selected = journal.lines.filter((line) => lineIds.includes(line.id));
  if (selected.length !== lineIds.length)
    v.rule('همه اقلام باید متعلق به همین سند باشند.');
  const detailKey = `detail${level}Id` as
    'detail4Id' | 'detail5Id' | 'detail6Id';
  const recipientId = selected[0]![detailKey];
  if (!recipientId || selected.some((line) => line[detailKey] !== recipientId))
    v.rule('تفصیلی سطح انتخاب‌شده باید در همه اقلام یکسان و مشخص باشد.');
  const recipient = await tx.accountingDetail.findFirst({
    where: { id: recipientId, bookId: book.id },
  });
  if (!recipient) v.rule('گیرنده اعلامیه در این دفتر وجود ندارد.');
  const accounts = await tx.accountingAccount.findMany({
    where: {
      id: {
        in: selected.flatMap((line) =>
          line.accountId ? [line.accountId] : [],
        ),
      },
      bookId: book.id,
      level: 'SUBSIDIARY',
    },
  });
  for (const line of selected) {
    const account = accounts.find((item) => item.id === line.accountId);
    if (!account) v.rule('حساب معین قلم انتخاب‌شده معتبر نیست.');
    const attributes = v.attributes(account.attributes);
    const assigned =
      attributes[`detail${level}TypeIds`] ??
      (attributes[`detail${level}TypeId`]
        ? [attributes[`detail${level}TypeId`]]
        : []);
    if (!Array.isArray(assigned) || !assigned.includes(recipient.typeId))
      v.rule('سطح انتخاب‌شده باید به حساب معین همه اقلام تخصیص یافته باشد.');
  }
  const rows = selected.map((line) => {
    const debit = line.debit.toString(),
      credit = line.credit.toString();
    if (
      (DecimalValue.parse(debit).isZero && DecimalValue.parse(credit).isZero) ||
      (!DecimalValue.parse(debit).isZero && !DecimalValue.parse(credit).isZero)
    )
      v.rule('قلم اعلامیه باید مبلغ بدهکار یا بستانکار داشته باشد.');
    const account = accounts.find((item) => item.id === line.accountId)!;
    const foreign =
      v.attributes(account.attributes).multiCurrency === true &&
      line.currency &&
      line.currency !== book.baseCurrency;
    const currency = foreign ? line.currency! : book.baseCurrency;
    const currencyName = input.currencyMode
      ? currencies.find((item) => item.code === currency)?.name
      : '';
    if (input.currencyMode && !currencyName)
      v.rule('عنوان واقعی ارز قلم در اطلاعات پایه موجود نیست.');
    if (input.currencyMode && foreign && !line.foreignAmount)
      v.rule('مبلغ ارزی قلم ذخیره‌شده موجود نیست.');
    const foreignAmount = foreign
      ? (line.foreignAmount?.toString() ?? '0')
      : !DecimalValue.parse(debit).isZero
        ? debit
        : credit;
    return {
      id: line.id,
      journalId,
      number: journal.number,
      position: line.position + 1,
      reference: journal.reference,
      documentDate: journal.documentDate!,
      description: line.description,
      descriptionEn: String(v.attributes(line.attributes).descriptionEn ?? ''),
      currency,
      currencyName: currencyName ?? '',
      debit,
      credit,
      foreignDebit: !DecimalValue.parse(debit).isZero ? foreignAmount : '0',
      foreignCredit: !DecimalValue.parse(credit).isZero ? foreignAmount : '0',
    };
  });
  const hasDebit = rows.some((row) => !DecimalValue.parse(row.debit).isZero),
    hasCredit = rows.some((row) => !DecimalValue.parse(row.credit).isZero);
  const balance = rows
    .reduce(
      (sum, row) =>
        sum
          .add(DecimalValue.parse(row.debit))
          .subtract(DecimalValue.parse(row.credit)),
      DecimalValue.parse('0'),
    )
    .toString();
  const basis = {
    journalId,
    journalVersion: journal.version,
    periodId: journal.periodId,
    recipientId,
    recipientCode: recipient.code,
    recipientTitle: recipient.title,
    level,
    currencyMode: input.currencyMode,
    type:
      hasDebit && hasCredit
        ? ('BOTH' as const)
        : hasDebit
          ? ('DEBIT' as const)
          : ('CREDIT' as const),
    balance,
    rows,
  };
  return {
    ...basis,
    checksum: createHash('sha256').update(JSON.stringify(basis)).digest('hex'),
  };
}
