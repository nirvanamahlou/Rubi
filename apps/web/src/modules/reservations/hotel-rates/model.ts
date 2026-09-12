export const kinds = [
  'double',
  'single',
  'triple',
  'doubleChild',
  'doubleTwoChildren',
  'family',
] as const;
export const labels = [
  'دبل',
  'سینگل',
  'تریپل',
  'دبل + ۱ بچه',
  'دبل + ۲ بچه',
  'فمیلی',
];
export type Factors = Record<(typeof kinds)[number], string>;
export const initialFactors: Factors = {
  double: '1',
  single: '1.5',
  triple: '1.3',
  doubleChild: '1.2',
  doubleTwoChildren: '1.4',
  family: '2',
};
/** Exact decimal multiplication with half-up rounding. */
export function price(base: string, factor: string, currency: string): string {
  if (
    !/^\d{1,12}(\.\d{1,2})?$/.test(base) ||
    !/^\d{1,3}(\.\d{1,3})?$/.test(factor)
  )
    return '—';
  const scaled = (text: string, places: number) => {
    const [i, f = ''] = text.split('.');
    return BigInt(i!) * 10n ** BigInt(places) + BigInt(f.padEnd(places, '0'));
  };
  const divisor = currency === 'IRR' ? 100000n : 1000n;
  const rounded =
    (scaled(base, 2) * scaled(factor, 3) + divisor / 2n) / divisor;
  return currency === 'IRR'
    ? rounded.toString()
    : `${rounded / 100n}.${(rounded % 100n).toString().padStart(2, '0')}`;
}
