import { Prisma } from '@nora/database';
import { DecimalValue } from '../finance.money';

export function purchaseFxComparison(
  amount: string,
  rate: string | null,
  payments: readonly { paidAmount: string; rialEquivalent: string }[],
) {
  const foreign = DecimalValue.parse(amount);
  const paid = payments.reduce(
    (sum, p) => sum.add(DecimalValue.parse(p.paidAmount)),
    DecimalValue.zero(),
  );
  const actual = payments.reduce(
    (sum, p) => sum.add(DecimalValue.parse(p.rialEquivalent)),
    DecimalValue.zero(),
  );
  const baseline = rate ? DecimalValue.parse(rate) : null;
  const paidBaseline = baseline
    ? paid.multiply(baseline).round(4, 'HALF_UP')
    : null;
  const ExactDecimal = Prisma.Decimal.clone({ precision: 60 });
  const average = paid.isZero
    ? null
    : new ExactDecimal(actual.toString()).div(paid.toString());
  return {
    averagePaidRateToIrr: average?.toFixed(8) ?? null,
    gainLossPerUnit:
      average && baseline
        ? new ExactDecimal(baseline.toString()).sub(average).toFixed(8)
        : null,
    baselineEquivalent: baseline
      ? foreign.multiply(baseline).round(4, 'HALF_UP').toString()
      : null,
    paidForeignAmount: paid.toString(),
    paidBaselineEquivalent: paidBaseline?.toString() ?? null,
    actualPaidEquivalent: actual.round(4, 'HALF_UP').toString(),
    realizedGainLoss: paidBaseline
      ? paidBaseline.subtract(actual.round(4, 'HALF_UP')).toString()
      : null,
  };
}
