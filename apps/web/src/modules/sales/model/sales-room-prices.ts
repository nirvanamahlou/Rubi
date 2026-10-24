import { enforceSalesHotelCapacity } from '@nora/contracts';
import { usesRoomDrivenGuests } from './contract-guest-stays';
import { moneyUnits, moneyDecimal } from '@nora/contracts';
import type { SalesMoney } from '@nora/contracts';
import type { SalesFormState } from './sales-form';
export function roomPartyUsage(
  rooms: SalesFormState['hotel']['rooms'],
  assignments?: SalesFormState['hotelChildAssignments'],
) {
  const result = { adults: 0, children: 0, infants: 0, total: 0 };
  for (const room of rooms ?? []) {
    result.adults += room.adults;
    result.total += room.adults + room.childAges.length;
    room.childAges.forEach((age, index) => {
      const key = assignments?.[String(room.ordinal)]?.[index];
      if (key?.startsWith('child:')) result.children++;
      else if (key?.startsWith('infant:')) result.infants++;
      else if (key === 'adult' || (age !== null && age >= 12)) result.adults++;
      else if (age !== null && age >= 2) result.children++;
      else if (age !== null) result.infants++;
    });
  }
  return result;
}
export function salesRoomPartyError(state: SalesFormState): string | null {
  if (!enforceSalesHotelCapacity()) return null;
  if (
    !state.serviceKinds.includes('HOTEL') ||
    !state.serviceKinds.includes('FLIGHT') ||
    !state.hotel.rooms?.length
  )
    return null;
  const used = roomPartyUsage(state.hotel.rooms, state.hotelChildAssignments);
  const extra = usesRoomDrivenGuests(state)
    ? (state.flightOnlyPassengers ?? [])
    : [];
  const p = state.passengerComposition;
  used.adults += extra.filter((p) => p.age >= 12).length;
  used.children += extra.filter((p) => p.age >= 2 && p.age < 12).length;
  used.infants += extra.filter((p) => p.age < 2).length;
  used.total += extra.length;
  return used.adults !== p.adults ||
    used.children !== p.children ||
    used.infants !== p.infants ||
    used.total !== p.adults + p.children + p.infants
    ? 'تعداد بزرگسال، کودک و نوزاد اتاق‌ها باید با مسافران پرواز برابر باشد.'
    : null;
}
export function roomAgreedTotals(
  rooms: SalesFormState['hotel']['rooms'],
): SalesMoney[] {
  const totals = new Map<string, bigint>();
  for (const r of rooms ?? []) {
    const p = r.agreedPrice;
    if (
      !p ||
      !/^[A-Z]{3}$/.test(p.currencyCode) ||
      !/^\d{1,18}(?:\.\d{1,4})?$/.test(p.amount)
    )
      continue;
    totals.set(
      p.currencyCode,
      (totals.get(p.currencyCode) ?? 0n) + moneyUnits(p.amount),
    );
  }
  return [...totals].map(([currencyCode, amount]) => ({
    currencyCode,
    amount: moneyDecimal(amount),
  }));
}
export function withRoomPriceTotals(
  state: SalesFormState,
  rooms: SalesFormState['hotel']['rooms'],
): SalesMoney[] {
  const values = new Map(
    (state.contractPrices ?? []).map((p) => [p.currencyCode, p.amount]),
  );
  const previous = new Map(
    roomAgreedTotals(state.hotel.rooms).map((p) => [
      p.currencyCode,
      moneyUnits(p.amount),
    ]),
  );
  const next = new Map(
    roomAgreedTotals(rooms).map((p) => [p.currencyCode, moneyUnits(p.amount)]),
  );
  for (const code of new Set([...previous.keys(), ...next.keys()])) {
    const old = values.get(code);
    const current =
      old && /^\d{1,18}(?:\.\d{1,4})?$/.test(old) ? moneyUnits(old) : 0n;
    const amount =
      current - (previous.get(code) ?? 0n) + (next.get(code) ?? 0n);
    values.set(code, moneyDecimal(amount < 0n ? 0n : amount));
  }
  return [...values].map(([currencyCode, amount]) => ({
    currencyCode,
    amount,
  }));
}
