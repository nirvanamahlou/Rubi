import type { HotelSaleAdjustmentV1 } from './index';

/** Exact, bounded, half-up currency arithmetic. No floating-point money. */
export function calculateManualHotelPrices(
  base: string,
  coefficient: string,
  currency: string,
  adjustment: HotelSaleAdjustmentV1 = { kind: 'AMOUNT', value: '0' },
): { purchase: string; sale: string } | null {
  if (
    !['EUR', 'USD', 'IRR'].includes(currency) ||
    !/^\d{1,12}(?:\.\d{1,2})?$/.test(base) ||
    !/^\d{1,3}(?:\.\d{1,3})?$/.test(coefficient) ||
    !/^-?\d{1,12}(?:\.\d{1,2})?$/.test(adjustment.value) ||
    !['AMOUNT', 'PERCENT', 'SET'].includes(adjustment.kind)
  )
    return null;
  const scale = (value: string, places: number) => {
    const negative = value.startsWith('-');
    const [whole = '0', fraction = ''] = value.replace(/^-/, '').split('.');
    const amount =
      BigInt(whole) * 10n ** BigInt(places) +
      BigInt(fraction.padEnd(places, '0'));
    return negative ? -amount : amount;
  };
  const b = scale(base, 2),
    c = scale(coefficient, 3),
    v = scale(adjustment.value, 2);
  if (b <= 0n || c <= 0n || (currency === 'IRR' && b % 100n !== 0n))
    return null;
  const round = (amount: bigint, divisor: bigint) =>
    (amount + divisor / 2n) / divisor;
  const precision = currency === 'IRR' ? 0 : 2;
  const purchase = round(b * c, precision === 0 ? 100000n : 1000n);
  let sale: bigint;
  if (adjustment.kind === 'PERCENT') {
    if (v < -10000n || v > 1000000n) return null;
    sale = round(purchase * (10000n + v), 10000n);
  } else {
    if (precision === 0 && v % 100n !== 0n) return null;
    const units = precision === 0 ? v / 100n : v;
    sale = adjustment.kind === 'SET' ? units : purchase + units;
  }
  const maximum = precision === 0 ? 999999999999n : 99999999999999n;
  if (purchase <= 0n || purchase > maximum || sale < 0n || sale > maximum)
    return null;
  const format = (value: bigint) =>
    precision === 0
      ? String(value)
      : `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
  return { purchase: format(purchase), sale: format(sale) };
}
