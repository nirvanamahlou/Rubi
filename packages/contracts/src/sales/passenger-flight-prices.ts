import { moneyUnits, moneyDecimal } from './pricing';
import type {
  SalesMoney,
  SalesServiceInput,
  SalesPassengerInput,
  SalesPriceComponentInput,
} from './index';
export const PASSENGER_FLIGHT_PRICES = 'passengerFlightPricesV1';
export type PassengerFlightPrices = Record<string, SalesMoney[]>;
export function readPassengerFlightPrices(
  services: readonly Pick<SalesServiceInput, 'kind' | 'metadata'>[],
): PassengerFlightPrices | undefined {
  const values = services.filter(
    (s) => s.metadata?.[PASSENGER_FLIGHT_PRICES] !== undefined,
  );
  if (!values.length) return undefined;
  if (values.length !== 1 || values[0]!.kind !== 'FLIGHT')
    throw Error('قیمت پرواز مسافران معتبر نیست.');
  const raw = values[0]!.metadata![PASSENGER_FLIGHT_PRICES];
  if (typeof raw !== 'string' || raw.length > 100000)
    throw Error('قیمت پرواز مسافران معتبر نیست.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('قیمت پرواز مسافران معتبر نیست.');
  for (const rows of Object.values(value)) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 10)
      throw Error('قیمت پرواز هر مسافر را وارد کنید.');
    const codes = new Set<string>();
    for (const p of rows) {
      if (
        !p ||
        typeof p.amount !== 'string' ||
        typeof p.currencyCode !== 'string' ||
        !/^\d+(?:\.\d{1,4})?$/.test(p.amount) ||
        !/^[A-Z]{3}$/.test(p.currencyCode) ||
        codes.has(p.currencyCode) ||
        moneyUnits(p.amount) < 0n
      )
        throw Error('قیمت پرواز مسافران معتبر نیست.');
      codes.add(p.currencyCode);
    }
  }
  return value as PassengerFlightPrices;
}
export function validatePassengerFlightPrices(
  services: readonly SalesServiceInput[],
  passengers: readonly Pick<
    SalesPassengerInput,
    'customerId' | 'serviceClientKeys'
  >[],
  components: readonly SalesPriceComponentInput[],
) {
  const prices = readPassengerFlightPrices(services);
  if (!prices) return;
  const keys = new Set(
    services.filter((s) => s.kind === 'FLIGHT').map((s) => s.clientKey),
  );
  const ids = passengers
    .filter((p) => p.serviceClientKeys.some((k) => keys.has(k)))
    .map((p) => p.customerId);
  if (
    Object.keys(prices).length !== ids.length ||
    ids.some((id) => !Object.prototype.hasOwnProperty.call(prices, id))
  )
    throw Error('قیمت پرواز هر مسافر را وارد کنید.');
  const sums = new Map<string, bigint>(),
    totals = new Map<string, bigint>();
  for (const rows of Object.values(prices))
    for (const p of rows)
      sums.set(
        p.currencyCode,
        (sums.get(p.currencyCode) ?? 0n) + moneyUnits(p.amount),
      );
  for (const p of components)
    totals.set(
      p.currencyCode,
      (totals.get(p.currencyCode) ?? 0n) +
        moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n),
    );
  for (const [code, sum] of sums)
    if (
      (!totals.has(code) && !(code === 'IRR' && sum === 0n)) ||
      sum > (totals.get(code) ?? 0n)
    )
      throw Error('جمع قیمت پرواز مسافران نباید از مبلغ قرارداد بیشتر باشد.');
}

export function flightRoomTotals(
  prices: PassengerFlightPrices,
  rooms: readonly { agreedPrice?: SalesMoney }[],
): SalesMoney[] {
  const totals = new Map<string, bigint>();
  for (const p of [
    ...Object.values(prices).flat(),
    ...rooms.flatMap((r) => (r.agreedPrice ? [r.agreedPrice] : [])),
  ]) {
    if (!p.amount.trim()) continue;
    totals.set(
      p.currencyCode,
      (totals.get(p.currencyCode) ?? 0n) + moneyUnits(p.amount),
    );
  }
  return [...totals].map(([currencyCode, n]) => ({
    currencyCode,
    amount: moneyDecimal(n),
  }));
}
export function roomPriceShares(
  rooms: readonly { adults: number; agreedPrice?: SalesMoney }[],
  adultIds: readonly string[],
): PassengerFlightPrices {
  const result: PassengerFlightPrices = {};
  let index = 0;
  for (const room of rooms) {
    const ids = adultIds.slice(index, index + room.adults);
    index += room.adults;
    if (!room.agreedPrice) continue;
    if (ids.length !== room.adults)
      throw Error('تعداد بزرگسالان اتاق‌ها با مسافران هتل هماهنگ نیست.');
    const units = moneyUnits(room.agreedPrice.amount),
      count = BigInt(room.adults);
    ids.forEach((id, i) => {
      const amount = moneyDecimal(
        units / count + (BigInt(i) < units % count ? 1n : 0n),
      );
      (result[id] ??= []).push({
        amount,
        currencyCode: room.agreedPrice!.currencyCode,
      });
    });
  }
  return Object.fromEntries(
    Object.entries(result).map(([id, rows]) => [
      id,
      flightRoomTotals({ [id]: rows }, []),
    ]),
  );
}

export const PASSENGER_HOTEL_PRICES = 'passengerHotelPricesV1';
export function readPassengerHotelPrices(
  services: readonly SalesServiceInput[],
  passengers: readonly Pick<
    SalesPassengerInput,
    'customerId' | 'serviceClientKeys'
  >[],
): PassengerFlightPrices | undefined {
  const hotel = services.find(
    (s) =>
      s.kind === 'HOTEL' && s.metadata?.[PASSENGER_HOTEL_PRICES] !== undefined,
  );
  if (!hotel) return undefined;
  const prices = readPassengerFlightPrices([
    {
      kind: 'FLIGHT',
      metadata: {
        [PASSENGER_FLIGHT_PRICES]: hotel.metadata![PASSENGER_HOTEL_PRICES]!,
      },
    },
  ])!;
  const ids = passengers
    .filter((p) => p.serviceClientKeys.includes(hotel.clientKey))
    .map((p) => p.customerId);
  if (
    Object.keys(prices).length !== ids.length ||
    ids.some((id) => !prices[id])
  )
    throw Error('قیمت هتل هر مسافر را وارد کنید.');
  return prices;
}
