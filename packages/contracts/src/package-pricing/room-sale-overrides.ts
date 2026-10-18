import { packageRoomIdentity } from './room-compositions';
import type { TourRoomCurrencyAmount } from './tour-calculation';

/** Final per-person package sale, independent of the immutable hotel purchase. */
export interface PackageRoomSaleOverrideV1 {
  hotelRateId: string;
  roomCode: string;
  currencyCode: string;
  amount: string;
}

const precision = (currency: string) => (currency === 'IRR' ? 0 : 2);
const units = (value: string, p: number) => {
  if (!/^\d{1,20}(?:\.\d{1,2})?$/.test(value))
    throw Error('قیمت فروش معتبر نیست.');
  const [whole, fraction = ''] = value.split('.');
  if (fraction.slice(p).replace(/0/g, ''))
    throw Error('دقت مبلغ با ارز سازگار نیست.');
  return (
    BigInt(whole!) * 10n ** BigInt(p) +
    BigInt(fraction.slice(0, p).padEnd(p, '0') || '0')
  );
};
const text = (n: bigint, p: number) => {
  const sign = n < 0n ? '-' : '';
  const a = n < 0n ? -n : n;
  const scale = 10n ** BigInt(p);
  return (
    sign +
    String(a / scale) +
    (p ? '.' + String(a % scale).padStart(p, '0') : '')
  );
};
export function validatePackageRoomSales(
  value: unknown,
): PackageRoomSaleOverrideV1[] {
  if (!Array.isArray(value) || value.length > 1500)
    throw Error('قیمت فروش معتبر نیست.');
  const seen = new Set<string>();
  return value.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.hotelRateId !== 'string' ||
      !item.hotelRateId ||
      (!['single', 'double', 'doubleChild'].includes(item.roomCode) &&
        !packageRoomIdentity(item.roomCode)) ||
      !/^[A-Z]{3}$/.test(item.currencyCode ?? '') ||
      typeof item.amount !== 'string'
    )
      throw Error('قیمت فروش معتبر نیست.');
    const key = JSON.stringify([
      item.hotelRateId,
      item.roomCode,
      item.currencyCode,
    ]);
    if (seen.has(key)) throw Error('قیمت فروش تکراری است.');
    seen.add(key);
    return {
      hotelRateId: item.hotelRateId,
      roomCode: item.roomCode,
      currencyCode: item.currencyCode,
      amount: text(
        units(item.amount, precision(item.currencyCode)),
        precision(item.currencyCode),
      ),
    };
  });
}

export function changePackageSale(
  current: string,
  currency: string,
  kind: 'PERCENT' | 'AMOUNT' | 'SET',
  value: string,
  direction: 'increase' | 'decrease',
) {
  const p = precision(currency),
    base = units(current, p);
  const n = units(value, kind === 'PERCENT' ? 2 : p);
  if (kind === 'PERCENT' && n > 10000n)
    throw Error('درصد تغییر بیش از ۱۰۰ نیست.');
  const delta = kind === 'PERCENT' ? (base * n + 5000n) / 10000n : n;
  const result =
    kind === 'SET' ? n : direction === 'decrease' ? base - delta : base + delta;
  if (result < 0n) throw Error('قیمت فروش منفی مجاز نیست.');
  return text(result, p);
}

export function applyPackageRoomSales<
  T extends {
    hotelRateId: string;
    roomCode: string;
    currencyAmounts: TourRoomCurrencyAmount[];
  },
>(
  price: T,
  overrides: readonly PackageRoomSaleOverrideV1[],
  commissionMode: 'percent' | 'fixed',
  commissionPercent: string,
): T {
  return {
    ...price,
    currencyAmounts: price.currencyAmounts.map((part) => {
      const override = overrides.find(
        (item) =>
          item.hotelRateId === price.hotelRateId &&
          item.roomCode === price.roomCode &&
          item.currencyCode === part.currencyCode,
      );
      if (!override) return part;
      const p = precision(part.currencyCode),
        sale = units(override.amount, p);
      const commission =
        commissionMode === 'percent'
          ? (sale * units(commissionPercent, 2) + 5000n) / 10000n
          : units(part.commission, p);
      return {
        ...part,
        sale: text(sale, p),
        commission: text(commission, p),
        profit:
          part.purchase === null
            ? null
            : text(sale - units(part.purchase, p) - commission, p),
      };
    }),
  };
}
