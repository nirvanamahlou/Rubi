import { packageRoomIdentity } from './room-compositions';
import type { PackagePublishedSaleV1 } from './index';

export function matchingPublishedRooms(
  catalog: readonly PackagePublishedSaleV1[],
  input: {
    hotelId: string;
    checkIn: string;
    checkOut: string;
    roomTypeId: string;
    adults: number;
    childAges: readonly number[];
  },
) {
  return catalog.filter((p) => {
    const room = packageRoomIdentity(p.roomCode);
    if (
      !room ||
      p.hotelId !== input.hotelId ||
      p.checkIn !== input.checkIn ||
      p.checkOut !== input.checkOut ||
      room.roomTypeId !== input.roomTypeId ||
      room.adults !== input.adults ||
      room.childAges.length !== input.childAges.length
    )
      return false;
    const ages = [...input.childAges].sort((a, b) => a - b);
    const bands = [...room.childAges].sort(
      (a, b) => a.min - b.min || a.maxExclusive - b.maxExclusive,
    );
    // Exact small bipartite matching supports overlapping age bands without relying on passenger order.
    const assigned = new Map<number, number>();
    function fit(i: number, seen: Set<number>): boolean {
      for (let j = 0; j < bands.length; j++) {
        const band = bands[j]!;
        if (seen.has(j) || ages[i]! < band.min || ages[i]! >= band.maxExclusive)
          continue;
        seen.add(j);
        const before = assigned.get(j);
        if (before === undefined || fit(before, seen)) {
          assigned.set(j, i);
          return true;
        }
      }
      return false;
    }
    return ages.every((_, i) => fit(i, new Set()));
  });
}
export function publishedSaleTotals(
  rows: readonly Pick<PackagePublishedSaleV1, 'prices'>[],
) {
  const totals = new Map<string, bigint>();
  for (const row of rows)
    for (const price of row.prices) {
      const p = price.currencyCode === 'IRR' ? 0 : 2;
      if (!/^\d+(?:\.\d+)?$/.test(price.amount))
        throw Error('قیمت فروش معتبر نیست.');
      const [whole, fraction = ''] = price.amount.split('.');
      if (fraction.slice(p).replace(/0/g, ''))
        throw Error('دقت مبلغ با ارز سازگار نیست.');
      const n =
        BigInt(whole!) * 10n ** BigInt(p) +
        BigInt(fraction.slice(0, p).padEnd(p, '0') || '0');
      totals.set(
        price.currencyCode,
        (totals.get(price.currencyCode) ?? 0n) + n,
      );
    }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, n]) => {
      const p = currencyCode === 'IRR' ? 0 : 2,
        scale = 10n ** BigInt(p);
      return {
        currencyCode,
        amount:
          String(n / scale) +
          (p ? '.' + String(n % scale).padStart(p, '0') : ''),
      };
    });
}
