import type {
  AccountingReportRowV1,
  AccountingReportV1,
} from '@nora/contracts';
import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

export function trialBalanceTable(
  rows: AccountingReportRowV1[],
  structure = '4',
  balanceType = 'ALL',
): NonNullable<AccountingReportV1['table']> {
  if (!['2', '4', '6', '8'].includes(structure))
    v.invalid('ساختار گزارش معتبر نیست.');
  if (!['ALL', 'DEBIT', 'CREDIT', 'NONZERO', 'ZERO'].includes(balanceType))
    v.invalid('نوع مانده معتبر نیست.');
  const groups =
    structure === '2'
      ? ['مانده طی دوره']
      : structure === '4'
        ? ['گردش طی دوره', 'مانده طی دوره']
        : structure === '6'
          ? ['گردش قبل دوره', 'گردش طی دوره', 'مانده تاکنون']
          : ['گردش قبل دوره', 'گردش طی دوره', 'گردش تا کنون', 'مانده تاکنون'];
  const headers = [
    'کد حساب',
    'عنوان حساب',
    ...groups.flatMap((group) => [`${group} — بدهکار`, `${group} — بستانکار`]),
  ];
  const totals = Array.from({ length: groups.length * 2 }, () =>
    DecimalValue.zero(),
  );
  const output: NonNullable<AccountingReportV1['table']>['rows'] = [];
  for (const row of rows) {
    const debit = DecimalValue.parse(row.debit),
      credit = DecimalValue.parse(row.credit);
    if (
      ['6', '8'].includes(structure) &&
      (row.priorDebit === undefined || row.priorCredit === undefined)
    )
      v.rule('اطلاعات گردش قبل دوره برای این گزارش موجود نیست.');
    const priorDebit = DecimalValue.parse(row.priorDebit ?? '0'),
      priorCredit = DecimalValue.parse(row.priorCredit ?? '0');
    const balance = ['2', '4'].includes(structure)
      ? debit.subtract(credit)
      : priorDebit.add(debit).subtract(priorCredit.add(credit));
    if (
      (balanceType === 'DEBIT' && (balance.isNegative || balance.isZero)) ||
      (balanceType === 'CREDIT' && !balance.isNegative) ||
      (balanceType === 'ZERO' && !balance.isZero) ||
      (balanceType === 'NONZERO' && balance.isZero)
    )
      continue;
    const balancePair = balance.isNegative
      ? [DecimalValue.zero(), DecimalValue.zero().subtract(balance)]
      : [balance, DecimalValue.zero()];
    const amounts =
      structure === '2'
        ? balancePair
        : structure === '4'
          ? [debit, credit, ...balancePair]
          : structure === '6'
            ? [priorDebit, priorCredit, debit, credit, ...balancePair]
            : [
                priorDebit,
                priorCredit,
                debit,
                credit,
                priorDebit.add(debit),
                priorCredit.add(credit),
                ...balancePair,
              ];
    amounts.forEach((amount, index) => {
      totals[index] = totals[index]!.add(amount);
    });
    output.push({
      accountId: row.accountId,
      values: [
        row.code,
        row.title,
        ...amounts.map((amount) => amount.toString()),
      ],
    });
  }
  return {
    structure,
    headers,
    rows: output,
    totals: ['جمع', '', ...totals.map((amount) => amount.toString())],
  };
}
