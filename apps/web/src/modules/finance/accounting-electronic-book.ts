import type { CompletionLineReport } from './accounting-completion-routes';
export function electronicBookRows(
  report: CompletionLineReport,
  flags: { code: boolean; title: boolean; description: boolean },
) {
  return [
    ['دفاتر تجاری الکترونیکی — گزارش داخلی'],
    [
      'از تاریخ',
      report.from,
      'تا تاریخ',
      report.to,
      'ارز',
      report.currency,
      'دفتر کل',
      report.bookTitle ?? '',
    ],
    [
      'شماره سند',
      'تاریخ',
      'کد حساب کل',
      'عنوان حساب کل',
      ...(flags.code ? ['کد حساب معین'] : []),
      ...(flags.title ? ['عنوان حساب معین'] : []),
      ...(flags.description ? ['شرح سند حسابداری'] : []),
      'شرح ردیف',
      'بدهکار',
      'بستانکار',
    ],
    ...report.rows.map((row) => [
      String(row.number ?? ''),
      row.date ?? '',
      row.generalCode ?? '',
      row.generalTitle ?? '',
      ...(flags.code ? [row.accountCode ?? ''] : []),
      ...(flags.title ? [row.accountTitle ?? ''] : []),
      ...(flags.description ? [row.journalDescription ?? ''] : []),
      row.description,
      row.debit,
      row.credit,
    ]),
    ['جمع بدهکار', report.debit, 'جمع بستانکار', report.credit],
  ];
}
