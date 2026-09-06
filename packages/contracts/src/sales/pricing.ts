import type { SalesPriceComponentInput, SalesServiceInput } from './index';

export interface SalesServicePricingV1 {
  version: 1;
  currencyCode: string;
  daySale: { basis: 'NIGHT' | 'TOTAL'; amount: string };
  agreed: { basis: 'NIGHT' | 'TOTAL'; amount: string };
}
export const moneyUnits = (value: string): bigint => {
  if (typeof value !== 'string' || !/^\d{1,18}(?:\.\d{1,4})?$/.test(value))
    throw new Error('مبلغ معتبر با حداکثر چهار رقم اعشار وارد کنید.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, '0'));
};
export function moneyDecimal(units: bigint): string {
  const sign = units < 0n ? '-' : '';
  const abs = units < 0n ? -units : units;
  const fraction = (abs % 10000n)
    .toString()
    .padStart(4, '0')
    .replace(/0+$/, '');
  return sign + (abs / 10000n).toString() + (fraction ? '.' + fraction : '');
}
export function hotelNights(checkIn: string, checkOut: string): number {
  const date = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new Error('تاریخ اقامت کامل نیست.');
    const at = new Date(value + 'T00:00:00.000Z');
    if (
      !Number.isFinite(at.getTime()) ||
      at.toISOString().slice(0, 10) !== value
    )
      throw new Error('تاریخ اقامت معتبر نیست.');
    return at.getTime();
  };
  const nights = (date(checkOut) - date(checkIn)) / 86400000;
  if (!Number.isInteger(nights) || nights <= 0)
    throw new Error('خروج هتل باید پس از ورود باشد.');
  return nights;
}
export function resolveSalesPrice(
  price: SalesServicePricingV1,
  nights: number,
  hotel: boolean,
) {
  if (price.version !== 1 || !/^[A-Z]{3}$/.test(price.currencyCode))
    throw new Error('ارز قیمت معتبر نیست.');
  const total = (part: SalesServicePricingV1['daySale']) => {
    if (
      !part ||
      !['NIGHT', 'TOTAL'].includes(part.basis) ||
      (!hotel && part.basis === 'NIGHT')
    )
      throw new Error('مبنای قیمت معتبر نیست.');
    if (!Number.isInteger(nights) || nights < 1)
      throw new Error('تعداد شب معتبر نیست.');
    const amount = moneyUnits(part.amount);
    if (amount <= 0n) throw new Error('مبلغ باید بیشتر از صفر باشد.');
    const result = part.basis === 'NIGHT' ? amount * BigInt(nights) : amount;
    moneyUnits(moneyDecimal(result));
    return result;
  };
  const day = total(price.daySale),
    agreed = total(price.agreed);
  return {
    dayTotal: moneyDecimal(day),
    agreedTotal: moneyDecimal(agreed),
    discount: moneyDecimal(day - agreed),
    dayNight: moneyDecimal(
      (day + BigInt(Math.floor(nights / 2))) / BigInt(nights),
    ),
    agreedNight: moneyDecimal(
      (agreed + BigInt(Math.floor(nights / 2))) / BigInt(nights),
    ),
    dayNightApproximate: day % BigInt(nights) !== 0n,
    agreedNightApproximate: agreed % BigInt(nights) !== 0n,
  };
}
export function servicePriceComponents(
  services: readonly SalesServiceInput[],
  stay?: { checkInDate: string; checkOutDate: string } | null,
): SalesPriceComponentInput[] | null {
  if (!services.some((service) => service.pricing !== undefined)) return null;
  return services.flatMap((service) => {
    if (!service.pricing?.length || service.pricing.length > 10)
      throw new Error('قیمت تمام خدمات را کامل کنید.');
    const codes = new Set<string>();
    return service.pricing.flatMap((price) => {
      if (codes.has(price.currencyCode))
        throw new Error('ارز تکراری برای یک خدمت مجاز نیست.');
      codes.add(price.currencyCode);
      const nights =
        service.kind === 'HOTEL' && stay
          ? hotelNights(stay.checkInDate, stay.checkOutDate)
          : 1;
      if (service.kind === 'HOTEL' && !stay)
        throw new Error('اقامت هتل کامل نیست.');
      const totals = resolveSalesPrice(price, nights, service.kind === 'HOTEL');
      const difference =
        moneyUnits(totals.dayTotal) - moneyUnits(totals.agreedTotal);
      const result: SalesPriceComponentInput[] = [
        {
          type: 'BASE',
          title: 'قیمت روز فروش: ' + service.titleSnapshot,
          amount: totals.dayTotal,
          currencyCode: price.currencyCode,
        },
      ];
      if (difference !== 0n)
        result.push({
          type: difference > 0n ? 'DISCOUNT' : 'SURCHARGE',
          title:
            (difference > 0n ? 'تخفیف فروشنده: ' : 'افزایش توافقی: ') +
            service.titleSnapshot,
          amount: moneyDecimal(difference > 0n ? difference : -difference),
          currencyCode: price.currencyCode,
        });
      return result;
    });
  });
}
