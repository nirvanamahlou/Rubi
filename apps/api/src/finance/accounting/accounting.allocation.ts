import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

export interface AllocationTarget {
  accountId: string;
  percentage: string;
}
export function allocationTargets(value: unknown): AllocationTarget[] {
  let parsed: unknown;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    v.invalid('مقصدهای الگوی تخصیص معتبر نیست.');
  }
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > 100)
    v.invalid('بین ۱ تا ۱۰۰ مقصد لازم است.');
  const rows = parsed.map((raw) => {
    const item = v.object(raw);
    return {
      accountId: v.uuid(item.accountId)!,
      percentage: v.decimal(item.percentage)!,
    };
  });
  if (new Set(rows.map((r) => r.accountId)).size !== rows.length)
    v.rule('حساب مقصد تکراری است.');
  if (
    rows
      .reduce(
        (sum, r) => sum.add(DecimalValue.parse(r.percentage)),
        DecimalValue.zero(),
      )
      .compare(DecimalValue.parse('100')) !== 0 ||
    rows.some((r) => r.percentage === '0')
  )
    v.rule('درصدهای مثبت مقصد باید در مجموع ۱۰۰ باشند.');
  return rows;
}
export function allocateAmount(
  amount: string,
  targets: AllocationTarget[],
  currency: string,
) {
  const total = DecimalValue.parse(amount);
  let distributed = DecimalValue.zero();
  const scale = currency === 'IRR' ? 0 : 2,
    rounding = currency === 'IRR' ? 'HALF_UP' : 'HALF_EVEN';
  const allocated = targets.map((target, index) => {
    const value =
      index === targets.length - 1
        ? total.subtract(distributed)
        : total
            .multiply(DecimalValue.parse(target.percentage))
            .multiply(DecimalValue.parse('0.01'))
            .round(scale, rounding);
    distributed = distributed.add(value);
    return { ...target, amount: value.toString() };
  });
  const last = allocated.at(-1)!;
  if (DecimalValue.parse(last.amount).isNegative) {
    let excess = DecimalValue.zero().subtract(DecimalValue.parse(last.amount));
    last.amount = '0';
    for (let i = allocated.length - 2; i >= 0 && !excess.isZero; i--) {
      const row = allocated[i]!,
        value = DecimalValue.parse(row.amount),
        reduction = value.compare(excess) > 0 ? excess : value;
      row.amount = value.subtract(reduction).toString();
      excess = excess.subtract(reduction);
    }
  }
  return allocated;
}
