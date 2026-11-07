import type { TourRoomCurrencyAmount } from './tour-calculation';
import type { PackageTourPriceFieldV1 } from './price-fields';

export type PackageRialRates = Record<string, string>;
/** Exact decimal multiplication; round once to the nearest rial, including losses. */
export function packageAmountToRial(
  amount: string,
  currency: string,
  rates: PackageRialRates,
): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(amount)) throw Error('مبلغ معتبر وارد کنید.');
  if (/^-?0+(?:\.0+)?$/.test(amount)) return '0';
  const rate = currency === 'IRR' ? '1' : rates[currency];
  if (!rate || !/^\d+(?:\.\d+)?$/.test(rate) || !/[1-9]/.test(rate))
    throw Error(
      'نرخ خرید معتبر برای تبدیل ارز به ریال موجود نیست: ' + currency,
    );
  if (!/^-?\d+(?:\.\d+)?$/.test(amount)) throw Error('مبلغ معتبر وارد کنید.');
  const decimal = (s: string) => {
    const [w = '0', f = ''] = s.split('.');
    return { n: BigInt(w + f), p: 10n ** BigInt(f.length) };
  };
  const negative = amount.startsWith('-');
  const a = decimal(amount.replace(/^-/, '')),
    r = decimal(rate);
  const n = a.n * r.n,
    p = a.p * r.p;
  return ((negative ? -1n : 1n) * ((n + p / 2n) / p)).toString();
}
export function packageFieldsToRial(
  fields: readonly PackageTourPriceFieldV1[],
  rates: PackageRialRates,
) {
  return fields.map((f) =>
    f.mode === 'percent'
      ? f
      : {
          ...f,
          amount: packageAmountToRial(f.amount, f.currencyCode, rates),
          currencyCode: 'IRR',
        },
  );
}
export function packageRoomToRial<
  T extends {
    hotelPurchase: string;
    hotelSale: string;
    currencyCode: string;
    currencyAmounts: TourRoomCurrencyAmount[];
  },
>(price: T, rates: PackageRialRates): T {
  const parts = price.currencyAmounts;
  const sum = (key: 'sale' | 'purchase' | 'commission') =>
    parts.reduce(
      (n, p) =>
        n + BigInt(packageAmountToRial(p[key] ?? '0', p.currencyCode, rates)),
      0n,
    );
  const sale = sum('sale'),
    commission = sum('commission');
  const purchase = parts.some((p) => p.purchase === null)
    ? null
    : sum('purchase');
  return {
    ...price,
    hotelPurchase: packageAmountToRial(
      price.hotelPurchase,
      price.currencyCode,
      rates,
    ),
    hotelSale: packageAmountToRial(price.hotelSale, price.currencyCode, rates),
    currencyCode: 'IRR',
    currencyAmounts: [
      {
        currencyCode: 'IRR',
        ...(parts.every((p) => p.priceBasis === 'HOTEL_ONLY')
          ? { priceBasis: 'HOTEL_ONLY' as const }
          : {}),
        sale: sale.toString(),
        purchase: purchase?.toString() ?? null,
        commission: commission.toString(),
        profit:
          purchase === null ? null : (sale - purchase - commission).toString(),
      },
    ],
  };
}
