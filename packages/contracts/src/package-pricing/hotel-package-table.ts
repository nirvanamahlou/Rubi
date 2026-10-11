import type { PackageTourHotelPurchaseRowV1 } from './index';
import { quoteHotelOccupancy } from './hotel-occupancy';
import {
  calculateTourRoom,
  type TourRoomCalculationInput,
} from './tour-calculation';

type Calculation = ReturnType<typeof calculateTourRoom>;
export interface HotelPackageTablePrice extends Calculation {
  hotelRateId: string;
  roomCode: 'single' | 'double' | 'doubleChild';
  roomTypeName: string;
  board: string;
  currencyCode: string;
  childAgeMin?: number;
  childAgeMaxExclusive?: number;
}
const precision = (currency: string) => (currency === 'IRR' ? 0 : 2);
const units = (value: string, p: number): bigint => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw Error('مبلغ معتبر نیست.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const extra = fraction.slice(p);
  let result =
    BigInt(whole!) * 10n ** BigInt(p) +
    BigInt(fraction.slice(0, p).padEnd(p, '0') || '0');
  if (extra && extra[0]! >= '5') result++;
  return negative ? -result : result;
};
const decimal = (value: bigint, p: number): string => {
  const sign = value < 0n ? '-' : '';
  const n = value < 0n ? -value : value,
    scale = 10n ** BigInt(p);
  return (
    sign + n / scale + (p ? '.' + (n % scale).toString().padStart(p, '0') : '')
  );
};
const divide = (value: string, currency: string) => {
  const p = precision(currency),
    n = units(value, p);
  return decimal(n < 0n ? -((-n + 1n) / 2n) : (n + 1n) / 2n, p);
};
function difference(
  a: Calculation,
  b: Calculation,
  currency: string,
): Calculation {
  const subtract = (x: string, y: string, code: string) =>
    decimal(
      units(x, precision(code)) - units(y, precision(code)),
      precision(code),
    );
  return {
    hotelPurchase: subtract(a.hotelPurchase, b.hotelPurchase, currency),
    hotelSale: subtract(a.hotelSale, b.hotelSale, currency),
    currencyAmounts: a.currencyAmounts.map((part) => {
      const before = b.currencyAmounts.find(
        (other) => other.currencyCode === part.currencyCode,
      );
      return {
        currencyCode: part.currencyCode,
        sale: subtract(part.sale, before?.sale ?? '0', part.currencyCode),
        commission: subtract(
          part.commission,
          before?.commission ?? '0',
          part.currencyCode,
        ),
        purchase:
          part.purchase === null
            ? null
            : subtract(
                part.purchase,
                before?.purchase ?? '0',
                part.currencyCode,
              ),
        profit:
          part.profit === null
            ? null
            : subtract(part.profit, before?.profit ?? '0', part.currencyCode),
      };
    }),
  };
}

/** Per-person rates. Never compares currencies/boards or substitutes capacity for a tariff. */
export function buildHotelPackageTable(input: {
  row: PackageTourHotelPurchaseRowV1;
  checkIn: string;
  checkOut: string;
  currencyCode: string;
  calculation: Omit<
    TourRoomCalculationInput,
    | 'basePerNight'
    | 'factor'
    | 'nights'
    | 'hotelCurrency'
    | 'adults'
    | 'children'
  >;
}): HotelPackageTablePrice[] {
  const { row, calculation } = input;
  const currency = row.currencyCode ?? input.currencyCode;
  const nights =
    (Date.parse(input.checkOut + 'T00:00:00Z') -
      Date.parse(input.checkIn + 'T00:00:00Z')) /
    86400000;
  if (!Number.isInteger(nights) || nights < 1 || nights > 366) return [];
  const occupancy = row.roomRates.flatMap((room) =>
    (room.occupancyRates ?? []).filter(
      (rate) =>
        rate.startsOn < input.checkOut && rate.endsOnExclusive > input.checkIn,
    ),
  );
  if (
    row.roomRates.some((room) => room.occupancyRates?.length) &&
    !occupancy.length
  )
    return [];
  const contexts = new Set(
    occupancy.map((rate) => rate.currencyCode + '\0' + rate.board),
  );
  if (
    contexts.size > 1 ||
    occupancy.some((rate) => rate.currencyCode !== currency)
  )
    return [];
  const board = occupancy[0]?.board ?? '';
  const calc = (amount: string, adults: number, children: number) =>
    calculateTourRoom({
      ...calculation,
      basePerNight: decimal(
        units(amount, precision(currency)),
        precision(currency),
      ),
      factor: '1',
      nights: 1,
      hotelCurrency: currency,
      adults,
      children,
    });
  type Candidate = {
    amount: string;
    roomTotal?: string;
    name: string;
    base?: string | undefined;
    min?: number;
    max?: number;
  };
  const candidates: Record<'single' | 'double' | 'doubleChild', Candidate[]> = {
    single: [],
    double: [],
    doubleChild: [],
  };
  if (occupancy.length) {
    for (const room of row.roomRates) {
      const rates = room.occupancyRates ?? [];
      const quote = (adults: number, childAges: number[]) =>
        quoteHotelOccupancy(rates, {
          adults,
          childAges,
          rooms: 1,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          currencyCode: currency,
          board,
          priceBasis: 'PURCHASE',
        })?.amount;
      const single = quote(1, []),
        double = quote(2, []);
      if (single !== undefined)
        candidates.single.push({ amount: single, name: room.roomTypeName });
      if (double !== undefined)
        candidates.double.push({ amount: double, name: room.roomTypeName });
      if (double === undefined) continue;
      const ranges = new Map(
        rates
          .filter(
            (rate) =>
              rate.adults === 2 &&
              rate.childAges.length === 1 &&
              (rate.childAges[0]!.min >= 6 ||
                /CWB|CHD\s*WB|with\s*bed|با\s*تخت/i.test(rate.composition)),
          )
          .map((rate) => [
            JSON.stringify(rate.childAges[0]),
            rate.childAges[0]!,
          ]),
      );
      for (const range of ranges.values()) {
        // A column advertises the entire age band; require the same quote at every
        // boundary, so overlapping or changing child tariffs cannot be hidden.
        const ages = [
          ...new Set([
            range.min,
            ...rates
              .flatMap((rate) =>
                rate.childAges.flatMap((age) => [age.min, age.maxExclusive]),
              )
              .filter((age) => age > range.min && age < range.maxExclusive),
          ]),
        ];
        const quotes = ages.map((age) => quote(2, [age]));
        if (
          quotes.some((value) => value === undefined) ||
          new Set(quotes).size !== 1
        )
          continue;
        const childTotal = quotes[0]!;
        const delta =
          units(childTotal, precision(currency)) -
          units(double, precision(currency));
        if (delta < 0n) continue;
        candidates.doubleChild.push({
          amount: decimal(delta, precision(currency)),
          base: double,
          roomTotal: childTotal,
          name: room.roomTypeName,
          min: range.min,
          max: range.maxExclusive,
        });
      }
    }
  } else {
    // Explicit legacy composition coefficients remain usable; room capacity alone
    // cannot establish a child's price or a single/double occupancy tariff.
    for (const code of ['single', 'double', 'doubleChild'] as const) {
      const factor = row.factors[code];
      if (!factor) continue;
      const total = calculateTourRoom({
        ...calculation,
        basePerNight: row.basePerNight,
        factor,
        nights,
        hotelCurrency: currency,
        adults: 1,
        children: 0,
      }).hotelPurchase;
      const base =
        code === 'doubleChild' && row.factors.double
          ? calculateTourRoom({
              ...calculation,
              basePerNight: row.basePerNight,
              factor: row.factors.double,
              nights,
              hotelCurrency: currency,
              adults: 1,
              children: 0,
            }).hotelPurchase
          : undefined;
      if (
        code === 'doubleChild' &&
        (!base ||
          units(total, precision(currency)) < units(base, precision(currency)))
      )
        continue;
      candidates[code].push({
        amount: base
          ? decimal(
              units(total, precision(currency)) -
                units(base, precision(currency)),
              precision(currency),
            )
          : total,
        base,
        name: code,
      });
    }
  }
  return (['single', 'double', 'doubleChild'] as const).flatMap((roomCode) => {
    const candidate = candidates[roomCode].sort((a, b) => {
      const delta =
        units(a.roomTotal ?? a.amount, precision(currency)) -
        units(b.roomTotal ?? b.amount, precision(currency));
      return delta < 0n ? -1 : delta > 0n ? 1 : a.name.localeCompare(b.name);
    })[0];
    if (!candidate) return [];
    let result = calc(candidate.amount, roomCode === 'double' ? 2 : 1, 0);
    if (roomCode === 'double')
      result = {
        hotelPurchase: divide(result.hotelPurchase, currency),
        hotelSale: divide(result.hotelSale, currency),
        currencyAmounts: result.currencyAmounts.map((part) => {
          const sale = divide(part.sale, part.currencyCode),
            commission = divide(part.commission, part.currencyCode);
          const purchase =
            part.purchase === null
              ? null
              : divide(part.purchase, part.currencyCode);
          const p = precision(part.currencyCode);
          return {
            ...part,
            sale,
            commission,
            purchase,
            profit:
              purchase === null
                ? null
                : decimal(
                    units(sale, p) - units(purchase, p) - units(commission, p),
                    p,
                  ),
          };
        }),
      };
    if (roomCode === 'doubleChild') {
      const base = candidate.base!;
      const total = decimal(
        units(base, precision(currency)) +
          units(candidate.amount, precision(currency)),
        precision(currency),
      );
      result = difference(calc(total, 2, 1), calc(base, 2, 0), currency);
    }
    return [
      {
        ...result,
        hotelRateId: row.id,
        roomCode,
        roomTypeName: candidate.name,
        board,
        currencyCode: currency,
        ...(candidate.min === undefined
          ? {}
          : {
              childAgeMin: candidate.min,
              childAgeMaxExclusive: candidate.max,
            }),
      },
    ];
  });
}
