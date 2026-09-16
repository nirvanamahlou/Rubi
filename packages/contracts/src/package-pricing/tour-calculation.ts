export interface TourRoomCurrencyAmount {
  currencyCode: string;
  purchase: string | null;
  sale: string;
  commission: string;
  profit: string | null;
}

export interface TourRoomCalculationInput {
  basePerNight: string;
  factor: string;
  nights: number;
  hotelCurrency: string;
  adjustment: {
    direction: 'increase' | 'decrease';
    mode: 'percent' | 'fixed';
    value: string;
  };
  adults: number;
  children: number;
  adultFlight: { amount: string; currencyCode: string };
  childFlight: { amount: string; currencyCode: string };
  businessUplift: { amount: string; currencyCode: string };
  businessCabin: boolean;
  commissionPercent: string;
  flightCosts?:
    | readonly {
        adultUnitCost: string;
        childUnitCost: string;
        currencyCode: string;
      }[]
    | undefined;
}

const scale = (currency: string) => (currency === 'IRR' ? 0 : 2);
const units = (value: string, precision: number): bigint => {
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('مبلغ معتبر وارد کنید.');
  const [whole = '0', fraction = ''] = value.split('.');
  if (fraction.slice(precision).replace(/0/g, '').length)
    throw new Error('دقت مبلغ با ارز سازگار نیست.');
  return (
    BigInt(whole) * 10n ** BigInt(precision) +
    BigInt(fraction.slice(0, precision).padEnd(precision, '0') || '0')
  );
};
const rounded = (value: bigint, divisor: bigint) =>
  (value + divisor / 2n) / divisor;
const formatted = (value: bigint, precision: number): string => {
  const sign = value < 0n ? '-' : '';
  const positive = value < 0n ? -value : value;
  const divisor = 10n ** BigInt(precision);
  return (
    sign +
    (positive / divisor).toString() +
    (precision
      ? '.' + (positive % divisor).toString().padStart(precision, '0')
      : '')
  );
};

/** Exact shared preview/publication arithmetic. Different currencies are never added. */
export function calculateTourRoom(input: TourRoomCalculationInput) {
  if (
    !Number.isSafeInteger(input.nights) ||
    input.nights < 1 ||
    !Number.isSafeInteger(input.adults) ||
    input.adults < 1 ||
    input.adults > 20 ||
    !Number.isSafeInteger(input.children) ||
    input.children < 0 ||
    input.children > 20
  )
    throw new Error('تعداد شب یا مسافران اتاق معتبر نیست.');
  const precision = scale(input.hotelCurrency);
  const purchase =
    rounded(
      units(input.basePerNight, precision) * units(input.factor, 3),
      1000n,
    ) * BigInt(input.nights);
  const adjustment = units(
    input.adjustment.value,
    input.adjustment.mode === 'percent' ? 2 : precision,
  );
  if (input.adjustment.mode === 'percent' && adjustment > 10000n)
    throw new Error('درصد تغییر بیش از ۱۰۰ نیست.');
  const delta =
    input.adjustment.mode === 'percent'
      ? rounded(purchase * adjustment, 10000n)
      : adjustment;
  const hotelSale =
    input.adjustment.direction === 'decrease'
      ? purchase - delta
      : purchase + delta;
  if (hotelSale < 0n) throw new Error('کاهش قیمت از خرید اقامت بیشتر است.');
  const commissionPercent = units(input.commissionPercent, 2);
  if (commissionPercent > 10000n) throw new Error('کمیسیون بیش از ۱۰۰ نیست.');
  const buckets = new Map<string, { purchase: bigint; sale: bigint }>();
  const add = (currency: string, field: 'purchase' | 'sale', value: bigint) => {
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('ارز معتبر نیست.');
    const bucket = buckets.get(currency) ?? { purchase: 0n, sale: 0n };
    bucket[field] += value;
    buckets.set(currency, bucket);
  };
  add(input.hotelCurrency, 'purchase', purchase);
  add(input.hotelCurrency, 'sale', hotelSale);
  for (const [money, count] of [
    [input.adultFlight, input.adults],
    [input.childFlight, input.children],
    [input.businessUplift, input.businessCabin ? input.adults : 0],
  ] as const) {
    const value =
      units(money.amount, scale(money.currencyCode)) * BigInt(count);
    if (value) add(money.currencyCode, 'sale', value);
  }
  for (const cost of input.flightCosts ?? []) {
    const value =
      units(cost.adultUnitCost, scale(cost.currencyCode)) *
        BigInt(input.adults) +
      units(cost.childUnitCost, scale(cost.currencyCode)) *
        BigInt(input.children);
    if (value) add(cost.currencyCode, 'purchase', value);
  }
  const currencyAmounts: TourRoomCurrencyAmount[] = [...buckets]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, bucket]) => {
      const commission = rounded(bucket.sale * commissionPercent, 10000n);
      const p = scale(currencyCode);
      return {
        currencyCode,
        sale: formatted(bucket.sale, p),
        purchase: input.flightCosts ? formatted(bucket.purchase, p) : null,
        commission: formatted(commission, p),
        profit: input.flightCosts
          ? formatted(bucket.sale - bucket.purchase - commission, p)
          : null,
      };
    });
  return {
    hotelPurchase: formatted(purchase, precision),
    hotelSale: formatted(hotelSale, precision),
    currencyAmounts,
  };
}

export function tourRoomOccupancy(
  roomCode: string,
  familyAdults?: number,
  familyChildren?: number,
) {
  switch (roomCode) {
    case 'single':
      return { adults: 1, children: 0 };
    case 'double':
      return { adults: 2, children: 0 };
    case 'triple':
      return { adults: 3, children: 0 };
    case 'doubleChild':
      return { adults: 2, children: 1 };
    case 'doubleTwoChildren':
      return { adults: 2, children: 2 };
    case 'family':
      return familyAdults === undefined || familyChildren === undefined
        ? null
        : { adults: familyAdults, children: familyChildren };
    default:
      return null;
  }
}
