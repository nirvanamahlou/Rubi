import { moneyDecimal, moneyUnits, type SalesMoney } from '@nora/contracts';
import {
  salesHotelGuestIds,
  salesPassengerFlightDirections,
  type SalesFormState,
} from './sales-form';

/** Preserve entered service prices in old drafts, without inventing room shares. */
export function passengerTotalEntry(
  state: SalesFormState,
  id: string,
): SalesMoney[] {
  if (Object.hasOwn(state.passengerPrices ?? {}, id))
    return state.passengerPrices![id]!;
  const sums = new Map<string, bigint>();
  for (const p of [
    ...(salesPassengerFlightDirections(state, id).length
      ? (state.passengerFlightPrices?.[id] ?? [])
      : []),
    ...(state.serviceKinds.includes('HOTEL') &&
    salesHotelGuestIds(state).includes(id)
      ? (state.passengerHotelPrices?.[id] ?? [])
      : []),
  ]) {
    if (!p.amount.trim()) continue;
    sums.set(
      p.currencyCode,
      (sums.get(p.currencyCode) ?? 0n) + moneyUnits(p.amount),
    );
  }
  return [...sums].map(([currencyCode, value]) => ({
    currencyCode,
    amount: moneyDecimal(value),
  }));
}

export function passengerTotalEntries(
  state: SalesFormState,
): Record<string, SalesMoney[]> {
  return Object.fromEntries(
    state.passengers.map((p) => {
      const rows = passengerTotalEntry(state, p.customerId).filter((v) =>
        v.amount.trim(),
      );
      if (!rows.length)
        throw Error(
          'قیمت ریالی یا ارزی کل خدمات هر مسافر را وارد کنید؛ برای مسافر رایگان صفر وارد کنید.',
        );
      return [p.customerId, rows] as const;
    }),
  );
}
