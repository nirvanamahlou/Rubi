import { moneyDecimal, type FinancePurchaseFxV1 } from '@nora/contracts';
const units = (value: string) => {
  if (!/^-?\d{1,50}(?:\.\d{1,4})?$/.test(value))
    throw new Error('Invalid FX amount');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const result = BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, '0'));
  return negative ? -result : result;
};
export function groupPurchaseFx(entries: readonly FinancePurchaseFxV1[]) {
  const groups = new Map<string, FinancePurchaseFxV1[]>();
  for (const entry of entries)
    groups.set(entry.currencyCode, [
      ...(groups.get(entry.currencyCode) ?? []),
      entry,
    ]);
  return [...groups].map(([currency, rows]) => {
    const sum = (
      key:
        | 'baselineEquivalent'
        | 'actualPaidEquivalent'
        | 'realizedGainLoss'
        | 'paidForeignAmount',
    ) =>
      rows.some((row) => row[key] === null)
        ? null
        : moneyDecimal(
            rows.reduce((total, row) => total + units(row[key]!), 0n),
          );
    const gain = sum('realizedGainLoss'),
      paid = sum('paidForeignAmount');
    let gainLossPerUnit: string | null = null;
    if (gain !== null && paid !== null && units(paid) > 0n) {
      const value = units(gain) * 100000000n;
      const denominator = units(paid);
      const negative = value < 0n;
      const perUnit =
        ((negative ? -value : value) + denominator / 2n) / denominator;
      gainLossPerUnit =
        (negative && perUnit > 0n ? '-' : '') +
        (perUnit / 100000000n).toString() +
        '.' +
        (perUnit % 100000000n).toString().padStart(8, '0');
    }
    return {
      ...rows[0]!,
      referenceId: currency,
      baselineEquivalent: sum('baselineEquivalent'),
      actualPaidEquivalent: sum('actualPaidEquivalent'),
      realizedGainLoss: gain,
      gainLossPerUnit,
    };
  });
}
