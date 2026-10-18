import { quoteHotelOccupancy } from './hotel-occupancy';
import { calculateTourRoom } from './tour-calculation';
import { buildHotelPackageTable } from './hotel-package-table';

export interface PackageRoomIdentity {
  roomTypeId: string;
  adults: number;
  childAges: { min: number; maxExclusive: number }[];
  board: string;
}
export function packageRoomCode(value: PackageRoomIdentity): string {
  return JSON.stringify([
    2,
    value.roomTypeId,
    value.adults,
    [...value.childAges]
      .sort((a, b) => a.min - b.min || a.maxExclusive - b.maxExclusive)
      .map((a) => [a.min, a.maxExclusive]),
    value.board,
  ]);
}
export function packageRoomIdentity(code: string): PackageRoomIdentity | null {
  if (typeof code !== 'string' || code.length > 2000) return null;
  try {
    const v: unknown = JSON.parse(code);
    if (
      !Array.isArray(v) ||
      v.length !== 5 ||
      v[0] !== 2 ||
      typeof v[1] !== 'string' ||
      !v[1] ||
      v[1].length > 160 ||
      !Number.isInteger(v[2]) ||
      v[2] < 1 ||
      v[2] > 20 ||
      !Array.isArray(v[3]) ||
      v[3].length > 20 ||
      typeof v[4] !== 'string' ||
      v[4].length > 120 ||
      v[3].some(
        (a: unknown) =>
          !Array.isArray(a) ||
          a.length !== 2 ||
          !Number.isInteger(a[0]) ||
          !Number.isInteger(a[1]) ||
          a[0] < 0 ||
          a[1] > 15 ||
          a[0] >= a[1],
      )
    )
      return null;
    return {
      roomTypeId: v[1],
      adults: v[2],
      childAges: v[3].map((a: number[]) => ({
        min: a[0]!,
        maxExclusive: a[1]!,
      })),
      board: v[4],
    };
  } catch {
    return null;
  }
}
export function packageRoomTitle(code: string): string {
  const room = packageRoomIdentity(code);
  if (!room)
    return (
      (
        {
          single: 'سینگل',
          double: 'دبل',
          doubleChild: 'دبل با کودک با تخت',
        } as Record<string, string>
      )[code] ?? code
    );
  return (
    `${room.adults} بزرگسال` +
    room.childAges
      .map((a) => ` + کودک ${a.min} تا کمتر از ${a.maxExclusive}`)
      .join('')
  );
}
/** Exact room totals, never a cheapest-room substitute. Every night and age boundary must match. */
export function buildHotelPackageCompositions(
  input: Parameters<typeof buildHotelPackageTable>[0],
) {
  if (!input.row.roomRates.some((room) => room.occupancyRates?.length))
    return buildHotelPackageTable(input);
  const currency = input.row.currencyCode ?? input.currencyCode;
  return input.row.roomRates.flatMap((room) => {
    const rates = room.occupancyRates ?? [];
    const identities = new Map<string, PackageRoomIdentity>();
    for (const rate of rates) {
      if (
        rate.currencyCode !== currency ||
        rate.startsOn >= input.checkOut ||
        rate.endsOnExclusive <= input.checkIn
      )
        continue;
      const identity = {
        roomTypeId: room.roomTypeId,
        adults: rate.adults,
        childAges: [...rate.childAges],
        board: rate.board,
      };
      identities.set(packageRoomCode(identity), identity);
    }
    return [...identities].flatMap(([roomCode, identity]) => {
      const quote = (ages: number[]) =>
        quoteHotelOccupancy(rates, {
          adults: identity.adults,
          childAges: ages,
          rooms: 1,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          currencyCode: currency,
          board: identity.board,
          priceBasis: 'PURCHASE',
        });
      // Enumerate all tariff boundaries inside the advertised bands, including overlaps.
      let ages: number[][] = [[]];
      for (const band of identity.childAges) {
        const boundaries = [
          ...new Set([
            band.min,
            ...rates
              .flatMap((r) =>
                r.childAges.flatMap((a) => [a.min, a.maxExclusive]),
              )
              .filter((a) => a > band.min && a < band.maxExclusive),
          ]),
        ];
        if (ages.length * boundaries.length > 4096) return [];
        ages = ages.flatMap((prefix) => boundaries.map((a) => [...prefix, a]));
      }
      const quotes = ages.map(quote);
      if (
        !quotes[0] ||
        quotes.some((q) => !q || q.amount !== quotes[0]!.amount)
      )
        return [];
      const calculated = calculateTourRoom({
        ...input.calculation,
        basePerNight: quotes[0].amount,
        factor: '1',
        nights: 1,
        hotelCurrency: currency,
        adults: identity.adults,
        children: identity.childAges.length,
      });
      return [
        {
          ...calculated,
          hotelRateId: input.row.id,
          roomCode,
          roomTypeName: room.roomTypeName,
          board: identity.board,
          currencyCode: currency,
        },
      ];
    });
  });
}
