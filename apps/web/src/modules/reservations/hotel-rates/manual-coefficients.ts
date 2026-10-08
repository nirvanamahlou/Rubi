import {
  calculateManualHotelPrices,
  type HotelOccupancyRateV1,
  type HotelSaleAdjustmentV1,
} from '@nora/contracts';

export type Combination = {
  id: string;
  label: string;
  adults: number;
  childAges: { min: number; maxExclusive: number }[];
  coefficient: string;
};
export const defaultCombinations = (): Combination[] => [
  { id: 'double', label: 'دبل', adults: 2, childAges: [], coefficient: '2' },
  { id: 'single', label: 'سینگل', adults: 1, childAges: [], coefficient: '' },
  {
    id: 'child-bed',
    label: 'کودک با تخت',
    adults: 2,
    childAges: [{ min: 2, maxExclusive: 15 }],
    coefficient: '',
  },
];
export const combinationKey = (
  row: Pick<HotelOccupancyRateV1, 'adults' | 'childAges'>,
) =>
  JSON.stringify([
    row.adults,
    row.childAges
      .map((a) => [a.min, a.maxExclusive])
      .sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!),
  ]);
export function combinationsFromRates(rates: readonly HotelOccupancyRateV1[]) {
  const manual = rates.filter((rate) => rate.manualPricing);
  if (!manual.length) return defaultCombinations();
  const restored = manual.map((rate, index) => ({
    id: `saved-${index}`,
    label: rate.composition,
    adults: rate.adults,
    childAges: rate.childAges.map((a) => ({ ...a })),
    coefficient: rate.manualPricing!.coefficient,
  }));
  return [
    ...restored,
    ...defaultCombinations()
      .filter(
        (c) => !restored.some((r) => combinationKey(r) === combinationKey(c)),
      )
      .map((c) => ({ ...c, coefficient: '' })),
  ];
}
export function buildManualRates(
  combinations: readonly Combination[],
  base: string,
  currency: string,
  startsOn: string,
  endsOnExclusive: string,
  adjustments: Readonly<Record<string, HotelSaleAdjustmentV1>> = {},
) {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const selected = combinations.filter((c) => c.coefficient !== '');
  if (
    !base ||
    !selected.length ||
    !validDate(startsOn) ||
    !validDate(endsOnExclusive) ||
    startsOn >= endsOnExclusive ||
    new Set(selected.map(combinationKey)).size !== selected.length
  )
    return null;
  const result: HotelOccupancyRateV1[] = [];
  for (const combination of selected) {
    if (
      !Number.isInteger(combination.adults) ||
      combination.adults < 1 ||
      combination.adults > 20 ||
      combination.childAges.length > 10 ||
      combination.childAges.some(
        (a) =>
          !Number.isInteger(a.min) ||
          !Number.isInteger(a.maxExclusive) ||
          a.min < 0 ||
          a.maxExclusive > 15 ||
          a.min >= a.maxExclusive,
      )
    )
      return null;
    const adjustment = adjustments[combinationKey(combination)] ?? {
      kind: 'AMOUNT',
      value: '0',
    };
    const calculated = calculateManualHotelPrices(
      base,
      combination.coefficient,
      currency,
      adjustment,
    );
    if (!calculated) return null;
    result.push({
      adults: combination.adults,
      childAges: combination.childAges.map((a) => ({ ...a })),
      composition:
        combination.label ||
        `${combination.adults} AD + ${combination.childAges.length} CHD`,
      board: '',
      startsOn,
      endsOnExclusive,
      currencyCode: currency,
      amount: calculated.purchase,
      saleAmount: calculated.sale,
      manualPricing: {
        baseAmount: base,
        coefficient: combination.coefficient,
        adjustment,
      },
    });
  }
  return result;
}

export function retimeManualRates(
  rates: readonly HotelOccupancyRateV1[],
  startsOn: string,
  endsOnExclusive: string,
) {
  return rates.map((rate) =>
    rate.manualPricing ? { ...rate, startsOn, endsOnExclusive } : rate,
  );
}
