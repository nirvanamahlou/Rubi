import { DecimalValue } from '../finance.money';
import * as v from './accounting.validation';

/** I01: distribute minor units by largest remainder, with stable position ties. */
export function distributeClosing(
  amount: string,
  percentages: string[],
  scale: number,
) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 8)
    v.invalid('دقت مبلغ معتبر نیست.');
  const values = percentages.map((p) =>
    DecimalValue.parse(v.decimalAtScale(p, 8)),
  );
  if (
    !values.length ||
    values.some((p) => p.isZero || p.isNegative) ||
    values
      .reduce((a, b) => a.add(b), DecimalValue.zero())
      .compare(DecimalValue.parse('100')) !== 0
  )
    v.rule('درصدهای مثبت مقصد باید در مجموع ۱۰۰ باشند.');
  const total = DecimalValue.parse(amount);
  if (total.round(scale, 'DOWN').compare(total) !== 0)
    v.rule('مانده با دقت ارز سازگار نیست.');
  const absolute = total.isNegative
    ? DecimalValue.zero().subtract(total)
    : total;
  const unit = DecimalValue.parse(scale ? `0.${'0'.repeat(scale - 1)}1` : '1');
  const parts = values.map((p, index) => {
    const raw = absolute.multiply(p).multiply(DecimalValue.parse('0.01'));
    const rounded = raw.round(scale, 'DOWN');
    return { index, rounded, remainder: raw.subtract(rounded) };
  });
  let remaining = absolute.subtract(
    parts.reduce((a, b) => a.add(b.rounded), DecimalValue.zero()),
  );
  for (const part of [...parts].sort(
    (a, b) => b.remainder.compare(a.remainder) || a.index - b.index,
  )) {
    if (remaining.isZero) break;
    part.rounded = part.rounded.add(unit);
    remaining = remaining.subtract(unit);
  }
  if (!remaining.isZero) v.rule('تسهیم مانده کامل نشد.');
  return parts.map((p) =>
    (total.isNegative
      ? DecimalValue.zero().subtract(p.rounded)
      : p.rounded
    ).toString(),
  );
}

export interface ClosingLot {
  accountId: string;
  detail4Id: string | null;
  detail5Id: string | null;
  detail6Id: string | null;
  balance: string;
  permanent: boolean;
}
export interface ClosingSelection {
  accountId: string;
  detail4Id: string | null;
  detail5Id: string | null;
  detail6Id: string | null;
  include: boolean;
  side: string;
}
/** Null detail is a wildcard. Exclusions dominate; overlapping inclusions fail. */
export function selectClosingLots<T extends ClosingLot>(
  lots: T[],
  selections: ClosingSelection[],
) {
  const matches = (lot: T, line: ClosingSelection) =>
    lot.accountId === line.accountId &&
    [4, 5, 6].every((level) => {
      const key = `detail${level}Id` as 'detail4Id' | 'detail5Id' | 'detail6Id';
      return !line[key] || line[key] === lot[key];
    }) &&
    (DecimalValue.parse(lot.balance).isNegative
      ? line.side === 'CREDIT'
      : line.side === 'DEBIT');
  const inclusions = selections.filter((s) => s.include);
  return lots.filter((lot) => {
    if (lot.permanent || selections.some((s) => !s.include && matches(lot, s)))
      return false;
    const count = inclusions.filter((s) => matches(lot, s)).length;
    if (count > 1) v.rule('انتخاب همپوشان مانده در الگوی بستن مجاز نیست.');
    return inclusions.length ? count === 1 : true;
  });
}

/** Historical carry must never flip the signed foreign residual to fit base rounding. */
export function validateHistoricalCarry(
  baseText: string,
  foreignText: string | null,
) {
  if (foreignText === null) return;
  const base = DecimalValue.parse(baseText),
    foreign = DecimalValue.parse(foreignText);
  if (foreign.isZero) return;
  if (base.isZero)
    v.rule('مانده ارزی با ارزش پایه صفر باید قبل از انتقال تعیین تکلیف شود.');
  if (base.isNegative !== foreign.isNegative)
    v.rule(
      'جهت مانده ارزی و پایه یکسان نیست؛ قبل از انتقال باید تعیین تکلیف شود.',
    );
}
