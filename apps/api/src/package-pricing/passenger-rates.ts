import { Prisma } from '@nora/database';

type Money = { currencyCode: string; amount: string };
export type PassengerRateKind = 'single' | 'double' | 'childWithBed' | 'extra';
export type PassengerRate = {
  kind: PassengerRateKind;
  hotelId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  childAgeMin?: number;
  childAgeMaxExclusive?: number;
  hotel: Money[];
  flight: Money[];
  total: Money[];
};
type RateInput = Omit<PassengerRate, 'hotel' | 'flight' | 'total'>;

function subtract(value: Money[], base: Money[], divisor = 1): Money[] | null {
  const amounts = new Map<string, Prisma.Decimal>();
  for (const p of value)
    amounts.set(
      p.currencyCode,
      (amounts.get(p.currencyCode) ?? new Prisma.Decimal(0)).plus(p.amount),
    );
  for (const p of base)
    amounts.set(
      p.currencyCode,
      (amounts.get(p.currencyCode) ?? new Prisma.Decimal(0)).minus(p.amount),
    );
  if ([...amounts.values()].some((amount) => amount.isNegative())) return null;
  return Array.from(amounts, ([currencyCode, amount]) => ({
    currencyCode,
    amount: amount
      .div(divisor)
      .toDecimalPlaces(currencyCode === 'IRR' ? 0 : 2)
      .toString(),
  }));
}
export function passengerRate(
  info: RateInput,
  hotel: Money[],
  flight: Money[],
  base?: { hotel: Money[]; flight: Money[] },
  divisor = 1,
): PassengerRate | null {
  const hotelPart = subtract(hotel, base?.hotel ?? [], divisor);
  const flightPart = subtract(flight, base?.flight ?? [], divisor);
  if (!hotelPart || !flightPart) return null;
  return {
    ...info,
    hotel: hotelPart,
    flight: flightPart,
    total: subtract([...hotelPart, ...flightPart], [])!,
  };
}
