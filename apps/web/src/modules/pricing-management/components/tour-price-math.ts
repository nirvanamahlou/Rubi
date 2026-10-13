export type HotelSaleAdjustment = {
  direction: 'increase' | 'decrease';
  mode: 'percent' | 'fixed';
  value: string;
};

const decimal = (value: string, scale: number): bigint | null => {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole = '0', fraction = ''] = value.split('.');
  if (fraction.length > scale) return null;
  return (
    BigInt(whole) * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, '0') || '0')
  );
};

const roundDiv = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;

const formatMinor = (value: bigint, scale: number) => {
  const unit = 10n ** BigInt(scale);
  const whole = value / unit;
  const fraction = value % unit;
  return scale === 0
    ? whole.toString()
    : whole.toString() + '.' + fraction.toString().padStart(scale, '0');
};

/** Read-only preview; publication recalculates from the source on the server. */
export function previewHotelRoomSale(
  basePerNight: string,
  factor: string,
  nights: number,
  currencyCode: string,
  adjustment: HotelSaleAdjustment,
): { purchase: string; sale: string } | null {
  const scale = currencyCode === 'IRR' ? 0 : 2;
  const base = decimal(basePerNight, scale);
  const multiplier = decimal(factor, 3);
  const value = decimal(
    adjustment.value || '0',
    adjustment.mode === 'fixed' && scale === 0 ? 0 : 2,
  );
  if (
    base === null ||
    multiplier === null ||
    value === null ||
    !Number.isSafeInteger(nights) ||
    nights <= 0
  )
    return null;
  const perNight = roundDiv(base * multiplier, 1000n);
  const purchase = perNight * BigInt(nights);
  const delta =
    adjustment.mode === 'percent' ? roundDiv(purchase * value, 10000n) : value;
  if (adjustment.direction === 'decrease' && delta > purchase) return null;
  const sale =
    adjustment.direction === 'decrease' ? purchase - delta : purchase + delta;
  return {
    purchase: formatMinor(purchase, scale),
    sale: formatMinor(sale, scale),
  };
}
