import type { HotelOccupancyRateV1 } from './index';

const dateStamp = (value: string): number => {
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(stamp) &&
    new Date(stamp).toISOString().slice(0, 10) === value
    ? stamp
    : NaN;
};

export function hotelMaximumCombinations(
  rates: readonly Pick<HotelOccupancyRateV1, 'adults' | 'childAges'>[],
): string {
  const pairs = [
    ...new Map(
      rates.map((r) => [
        `${r.adults}:${r.childAges.length}`,
        { a: r.adults, c: r.childAges.length },
      ]),
    ).values(),
  ];
  return pairs
    .filter(
      (p) =>
        !pairs.some(
          (q) => q.a >= p.a && q.c >= p.c && (q.a > p.a || q.c > p.c),
        ),
    )
    .sort((a, b) => b.a - a.a || b.c - a.c)
    .map((p) => `${p.a} AD + ${p.c} CHD`)
    .join(' / ');
}

export function hotelChildrenFit(
  ages: readonly number[],
  ranges: HotelOccupancyRateV1['childAges'],
): boolean {
  if (ages.length !== ranges.length) return false;
  if (ages.some((age) => !Number.isFinite(age) || age < 0)) return false;
  const ordered = [...ages].sort((a, b) => b - a);
  function match(index: number, used: Set<number>): boolean {
    if (index === ordered.length) return true;
    return ranges.some((range, slot) => {
      if (
        used.has(slot) ||
        ordered[index]! < range.min ||
        ordered[index]! >= range.maxExclusive
      )
        return false;
      used.add(slot);
      const result = match(index + 1, used);
      used.delete(slot);
      return result;
    });
  }
  return match(0, new Set());
}

const units = (amount: string) => {
  const [whole = '0', fraction = ''] = amount.split('.');
  return BigInt(whole) * 1000000000000n + BigInt(fraction.padEnd(12, '0'));
};
const decimal = (amount: bigint) => {
  // Preserve source nightly decimals; round the final financial total once.
  amount = (amount + 50000000n) / 100000000n;
  const fraction = (amount % 10000n)
    .toString()
    .padStart(4, '0')
    .replace(/0+$/, '');
  return `${amount / 10000n}${fraction ? `.${fraction}` : ''}`;
};

/** Exact room allocation, every stay night covered; never combines independent maxima. */
export function quoteHotelOccupancy(
  rates: readonly HotelOccupancyRateV1[],
  input: {
    adults: number;
    childAges: readonly number[];
    rooms: number;
    checkIn: string;
    checkOut: string;
    currencyCode?: string;
    board?: string;
  },
): { amount: string; currencyCode: string } | null {
  const start = dateStamp(input.checkIn),
    end = dateStamp(input.checkOut);
  const nights = (end - start) / 86400000;
  if (
    !Number.isInteger(nights) ||
    nights < 1 ||
    nights > 366 ||
    !Number.isInteger(input.rooms) ||
    input.rooms < 1 ||
    input.rooms > 20 ||
    !Number.isInteger(input.adults) ||
    input.adults < 1 ||
    input.adults + input.childAges.length > 30 ||
    input.childAges.some((age) => !Number.isFinite(age) || age < 0 || age >= 18)
  )
    return null;
  const currencies = [...new Set(rates.map((row) => row.currencyCode))];
  const currency =
    input.currencyCode ?? (currencies.length === 1 ? currencies[0] : undefined);
  if (!currency) return null;
  const activeRates = rates.filter(
    (row) =>
      row.currencyCode === currency &&
      row.startsOn < input.checkOut &&
      row.endsOnExclusive > input.checkIn,
  );
  const boards = [...new Set(activeRates.map((row) => row.board))];
  const board = input.board ?? (boards.length === 1 ? boards[0] : undefined);
  if (board === undefined) return null;
  const options = activeRates.filter(
    (row) =>
      row.board === board && /^\d{1,12}(?:\.\d{1,12})?$/.test(row.amount),
  );
  const day = (stamp: number) => new Date(stamp).toISOString().slice(0, 10);
  let budget = 25000;
  const cache = new Map<string, bigint | null>();
  function roomPrice(adults: number, ages: number[]): bigint | null {
    let total = 0n;
    for (let night = 0; night < nights; night++) {
      const date = day(start + night * 86400000);
      const prices = options
        .filter(
          (row) =>
            row.adults === adults &&
            row.startsOn <= date &&
            row.endsOnExclusive > date &&
            hotelChildrenFit(ages, row.childAges),
        )
        .map((row) => units(row.amount));
      if (!prices.length) return null;
      if (new Set(prices.map(String)).size !== 1) return null;
      total += prices.reduce((a, b) => (a < b ? a : b));
    }
    return total;
  }
  function allocate(
    rooms: number,
    adults: number,
    ages: number[],
  ): bigint | null {
    if (--budget < 0) return null;
    if (rooms === 0) return adults === 0 && ages.length === 0 ? 0n : null;
    if (adults < rooms) return null;
    const key = JSON.stringify([rooms, adults, ages]);
    if (cache.has(key)) return cache.get(key)!;
    if (rooms === 1) return roomPrice(adults, ages);
    let best: bigint | null = null;
    const shapes = [
      ...new Set(options.map((row) => `${row.adults}:${row.childAges.length}`)),
    ];
    for (const shape of shapes) {
      const [a = 0, c = 0] = shape.split(':').map(Number);
      if (a < 1 || a > adults - (rooms - 1) || c > ages.length) continue;
      function subsets(index: number, selected: number[]) {
        if (--budget < 0) return;
        if (selected.length === c) {
          const used = new Set(selected);
          const part = roomPrice(
            a,
            selected.map((i) => ages[i]!),
          );
          if (part === null) return;
          const rest = allocate(
            rooms - 1,
            adults - a,
            ages.filter((_, i) => !used.has(i)),
          );
          if (rest !== null && (best === null || part + rest < best))
            best = part + rest;
          return;
        }
        for (let i = index; i <= ages.length - (c - selected.length); i++)
          subsets(i + 1, [...selected, i]);
      }
      subsets(0, []);
    }
    cache.set(key, best);
    return best;
  }
  const total = allocate(
    input.rooms,
    input.adults,
    [...input.childAges].sort((a, b) => a - b),
  );
  return budget < 0 || total === null
    ? null
    : { amount: decimal(total), currencyCode: currency };
}

export function hotelAgeOn(
  birthDate: string,
  travelDate: string,
): number | null {
  const birth = dateStamp(birthDate.slice(0, 10)),
    travel = dateStamp(travelDate.slice(0, 10));
  if (!Number.isFinite(birth) || !Number.isFinite(travel) || birth > travel)
    return null;
  const b = new Date(birth),
    t = new Date(travel);
  let age = t.getUTCFullYear() - b.getUTCFullYear();
  if (
    t.getUTCMonth() < b.getUTCMonth() ||
    (t.getUTCMonth() === b.getUTCMonth() && t.getUTCDate() < b.getUTCDate())
  )
    age--;
  return age;
}
