import { accountingDetailLevels } from '@nora/contracts';
import type {
  AccountingBookV1,
  AccountingJournalV1,
  AccountingLineV1,
  AccountingSnapshotV1,
} from '@nora/contracts';
import { journalDisplayTotals } from './accounting-money';

export const journalStates: Record<AccountingJournalV1['status'], string> = {
  MEMORANDUM: 'یادداشت',
  DRAFT: 'موقت',
  PENDING_APPROVAL: 'در حال بررسی',
  APPROVED: 'بررسی شده',
  POSTED: 'قطعی شده',
  CANCELLED: 'حذف شده',
};
export function defaultVoucherType(
  book: AccountingSnapshotV1,
  opening = false,
) {
  const types = book.configurations.filter(
    (item) => item.kind === 'voucher-types' && item.active,
  );
  if (opening) return types.find((item) => item.title === 'افتتاحیه استقرار');
  return (
    types.find((item) => String(item.attributes.isDefault) === 'true') ??
    types.find((item) => item.title === 'عمومی')
  );
}

export function baseFigures(row: AccountingLineV1, book: AccountingBookV1) {
  const values = journalDisplayTotals([row]);
  const base =
    values.valid && !(values.debit !== '0' && values.credit !== '0')
      ? values.debit !== '0'
        ? values.debit
        : values.credit
      : '';
  return {
    currency: book.baseCurrency,
    rate: !row.currency || row.currency === book.baseCurrency ? '1' : row.rate,
    amount: base,
  };
}

export function journalCurrencyBalances(
  lines: AccountingLineV1[],
  baseCurrency: string,
) {
  const groups = new Map<string, { debit: string; credit: string }[]>();
  for (const line of lines) {
    const currency = line.currency || baseCurrency;
    const values = journalDisplayTotals([line]);
    if (!values.valid || (values.debit !== '0' && values.credit !== '0'))
      return null;
    const amount =
      currency === baseCurrency
        ? values.debit === '0'
          ? values.credit
          : values.debit
        : line.foreignAmount;
    if (!amount?.trim()) return null;
    const group = groups.get(currency) ?? [];
    group.push({
      debit: values.debit === '0' ? '0' : amount,
      credit: values.credit === '0' ? '0' : amount,
    });
    groups.set(currency, group);
  }
  const balances = Array.from(groups, ([currency, rows]) => ({
    currency,
    ...journalDisplayTotals(rows),
  }));
  return balances.every((row) => row.valid) ? balances : null;
}
export function copiedVoucherLines(
  lines: AccountingLineV1[],
): AccountingLineV1[] {
  return lines.map((line) => {
    return {
      accountId: line.accountId,
      detail4Id: line.detail4Id,
      detail5Id: line.detail5Id,
      detail6Id: line.detail6Id,
      ...Object.fromEntries(
        accountingDetailLevels
          .filter((level) => level > 6 && line[`detail${level}Id`] != null)
          .map((level) => [`detail${level}Id`, line[`detail${level}Id`]]),
      ),
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      currency: line.currency,
      rate: line.rate,
      foreignAmount: line.foreignAmount,
      fxSnapshotId: line.fxSnapshotId ?? null,
      attributes: Object.fromEntries(
        Object.entries(line.attributes).filter(([key]) =>
          ['descriptionEn', 'trackingDate', 'trackingNumber'].includes(key),
        ),
      ),
    };
  });
}
export function voucherPrintRows(
  book: AccountingSnapshotV1,
  journal: AccountingJournalV1,
): string[][] {
  const totals = journalDisplayTotals(journal.lines);
  const accounts = new Map(book.accounts.map((a) => [a.id, a]));
  const details = new Map(book.details.map((d) => [d.id, d]));
  return [
    ['سند حسابداری', String(journal.number ?? '—'), book.book.title],
    [
      'تاریخ سند',
      journal.documentDate ?? '—',
      'شماره عطف',
      journal.reference ?? '—',
    ],
    [
      'نوع سند',
      book.configurations.find((t) => t.id === journal.typeId)?.title ?? '—',
      'وضعیت',
      journalStates[journal.status],
    ],
    ['شرح', journal.description],
    [
      'ردیف',
      'حساب معین',
      'تفصیلی‌ها',
      'شرح',
      'بدهکار',
      'بستانکار',
      'ارز',
      'مبلغ ارز',
    ],
    ...journal.lines.map((line, index) => {
      const account = accounts.get(line.accountId ?? '');
      const selected = accountingDetailLevels.flatMap((level) => {
        const id = line[`detail${level}Id`];
        const d = id && details.get(id);
        return d ? [`${level}: ${d.code} — ${d.title}`] : [];
      });
      return [
        String(index + 1),
        account ? account.code + ' — ' + account.title : '—',
        selected.join(' / '),
        line.description,
        line.debit,
        line.credit,
        line.currency ?? '',
        line.foreignAmount ?? '',
      ];
    }),
    [
      'مجموع',
      '',
      '',
      '',
      totals.debit,
      totals.credit,
      book.book.baseCurrency,
      '',
    ],
  ];
}
