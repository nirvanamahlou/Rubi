import type { HotelOccupancyRateV1, MasterDataRecord } from '@nora/contracts';
import type { ImportedOccupancy } from './occupancy-import';

export const importName = (value: string) =>
  value
    .normalize('NFKC')
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
const moneyValue = (value: string) => {
  const [whole = '', fraction = ''] = value.split('.');
  return `${whole.replace(/^0+(?=\d)/, '')}.${fraction.replace(/0+$/, '')}`;
};
export type BulkGroup = {
  checkIn: string;
  checkOut: string;
  currency: 'EUR' | 'USD' | 'IRR';
  hotels: Map<string, Map<string, HotelOccupancyRateV1[]>>;
};
const occupancyShape = (rate: HotelOccupancyRateV1) =>
  JSON.stringify([
    rate.adults,
    [...rate.childAges].sort(
      (a, b) => a.min - b.min || a.maxExclusive - b.maxExclusive,
    ),
  ]);
function canonicalSourceNames(rows: readonly ImportedOccupancy[]) {
  const names = (kind: 'hotel' | 'room') =>
    new Map(
      [...new Set(rows.map((r) => r[kind].trim()))]
        .sort()
        .reverse()
        .map((name) => [importName(name), name]),
    );
  const hotels = names('hotel'),
    rooms = names('room');
  return rows.map((row) => ({
    ...row,
    hotel: hotels.get(importName(row.hotel))!,
    room: rooms.get(importName(row.room))!,
  }));
}
// Explicit composition wins over ROOM only on covered days and the same guest shape.
export function resolveRoomPrices(rows: readonly ImportedOccupancy[]) {
  const key = (r: ImportedOccupancy) =>
    JSON.stringify([
      r.hotel,
      r.room,
      r.board,
      r.currencyCode,
      occupancyShape(r),
    ]);
  const explicit = new Map<string, ImportedOccupancy[]>();
  for (const row of rows)
    if (row.composition.trim().toUpperCase() !== 'ROOM') {
      const matches = explicit.get(key(row)) ?? [];
      matches.push(row);
      explicit.set(key(row), matches);
    }
  const resolved: ImportedOccupancy[] = [];
  let overriddenRooms = 0;
  let removedRoomRows = 0;
  for (const row of rows) {
    if (row.composition.trim().toUpperCase() !== 'ROOM') {
      resolved.push(row);
      continue;
    }
    let intervals = [
      { startsOn: row.startsOn, endsOnExclusive: row.endsOnExclusive },
    ];
    for (const match of explicit.get(key(row)) ?? []) {
      intervals = intervals.flatMap((part) => {
        if (
          match.endsOnExclusive <= part.startsOn ||
          match.startsOn >= part.endsOnExclusive
        )
          return [part];
        const remaining = [];
        if (part.startsOn < match.startsOn)
          remaining.push({
            startsOn: part.startsOn,
            endsOnExclusive: match.startsOn,
          });
        if (match.endsOnExclusive < part.endsOnExclusive)
          remaining.push({
            startsOn: match.endsOnExclusive,
            endsOnExclusive: part.endsOnExclusive,
          });
        return remaining;
      });
    }
    if (
      intervals.length !== 1 ||
      intervals[0]?.startsOn !== row.startsOn ||
      intervals[0]?.endsOnExclusive !== row.endsOnExclusive
    )
      overriddenRooms++;
    if (!intervals.length) removedRoomRows++;
    resolved.push(...intervals.map((interval) => ({ ...row, ...interval })));
  }
  return { rows: resolved, overriddenRooms, removedRoomRows };
}
export function reviewOccupancyBatch(rows: readonly ImportedOccupancy[]) {
  const resolved = resolveRoomPrices(canonicalSourceNames(rows));
  const shapes = new Map<string, ImportedOccupancy[]>();
  const rejected = new Set<number>();
  for (const row of resolved.rows) {
    const key = JSON.stringify([
      row.hotel,
      row.room,
      row.board,
      row.currencyCode,
      occupancyShape(row),
    ]);
    const previous = shapes.get(key) ?? [];
    for (const other of previous)
      if (
        other.startsOn < row.endsOnExclusive &&
        row.startsOn < other.endsOnExclusive &&
        moneyValue(other.amount) !== moneyValue(row.amount)
      ) {
        rejected.add(other.sourceRow);
        rejected.add(row.sourceRow);
      }
    previous.push(row);
    shapes.set(key, previous);
  }
  return {
    rows: resolved.rows.filter((row) => !rejected.has(row.sourceRow)),
    issues: rows
      .filter((row) => rejected.has(row.sourceRow))
      .map(
        (row) =>
          `ردیف ${row.sourceRow}: قیمت متعارض ${row.amount} ${row.currencyCode} برای ${row.hotel} / ${row.room} / ${row.composition}؛ ${row.startsOn} تا ${row.endsOnExclusive} (پایان غیرشامل).`,
      ),
    ignoredRoomCount: resolved.removedRoomRows,
    overriddenRooms: resolved.overriddenRooms,
  };
}
export function planOccupancyBatch(rows: readonly ImportedOccupancy[]) {
  if (!rows.length) throw Error('فایل نرخ معتبر ندارد.');
  const review = reviewOccupancyBatch(rows);
  if (review.issues.length) throw Error(review.issues[0]);
  const resolved = resolveRoomPrices(canonicalSourceNames(rows));
  const groups = new Map<string, BulkGroup>();
  const capacities = new Map<string, number>();
  const hotelNames = new Set<string>();
  for (const row of resolved.rows) {
    if (!['EUR', 'USD', 'IRR'].includes(row.currencyCode))
      throw Error(
        `ارز ${row.currencyCode} فعلاً برای ثبت بسته پشتیبانی نمی‌شود.`,
      );
    if (!row.hotel.trim() || !row.room.trim())
      throw Error('نام هتل یا اتاق خالی است.');
    hotelNames.add(row.hotel);
    capacities.set(
      row.room,
      Math.max(
        capacities.get(row.room) ?? 0,
        row.adults + row.childAges.length,
      ),
    );
    const key = JSON.stringify([
      row.startsOn,
      row.endsOnExclusive,
      row.currencyCode,
      row.board,
    ]);
    let group = groups.get(key);
    if (!group) {
      group = {
        checkIn: row.startsOn,
        checkOut: row.endsOnExclusive,
        currency: row.currencyCode as BulkGroup['currency'],
        hotels: new Map(),
      };
      groups.set(key, group);
    }
    let rooms = group.hotels.get(row.hotel);
    if (!rooms) {
      rooms = new Map();
      group.hotels.set(row.hotel, rooms);
    }
    const rates = rooms.get(row.room) ?? [];
    const rate: HotelOccupancyRateV1 = {
      adults: row.adults,
      childAges: row.childAges,
      startsOn: row.startsOn,
      endsOnExclusive: row.endsOnExclusive,
      amount: row.amount,
      currencyCode: row.currencyCode,
      composition: row.composition,
      board: row.board,
    };
    const shape = (r: HotelOccupancyRateV1) =>
      JSON.stringify([
        r.adults,
        [...r.childAges].sort(
          (a, b) => a.min - b.min || a.maxExclusive - b.maxExclusive,
        ),
      ]);
    if (
      rates.some(
        (r) =>
          shape(r) === shape(rate) &&
          moneyValue(r.amount) !== moneyValue(rate.amount),
      )
    )
      throw Error(
        `قیمت‌های متعارض برای ${row.hotel} / ${row.room} / ${row.composition}؛ ردیف ${row.sourceRow}`,
      );
    rates.push(rate);
    if (rates.length > 2000)
      throw Error(
        `بیش از ۲۰۰۰ نرخ برای اتاق ${row.room} در یک بازه وجود دارد.`,
      );
    rooms.set(row.room, rates);
    if (rooms.size > 30)
      throw Error(`بیش از ۳۰ نوع اتاق در یک بازه برای ${row.hotel} وجود دارد.`);
  }
  for (const capacity of capacities.values())
    if (capacity > 20)
      throw Error('ظرفیت نوع اتاق بیشتر از حد مجاز اطلاعات پایه است.');
  for (const names of [hotelNames, capacities.keys()]) {
    const normalized = [...names].map(importName);
    if (new Set(normalized).size !== normalized.length)
      throw Error(
        'نام‌های تکراری با نگارش متفاوت در فایل وجود دارد؛ ابتدا یکسان‌سازی کنید.',
      );
  }
  return {
    groups: [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, group]) => group),
    capacities,
    hotelNames,
    priceCount: resolved.rows.length,
    overriddenRooms: resolved.overriddenRooms,
  };
}

export function exactReference(
  records: readonly MasterDataRecord[],
  name: string,
) {
  const matches = records.filter((record) =>
    [record.name, String(record.attributes.englishName ?? '')].some(
      (value) => importName(value) === importName(name),
    ),
  );
  if (matches.length > 1)
    throw Error(
      `چند رکورد برای «${name}» وجود دارد؛ اطلاعات پایه را اصلاح کنید.`,
    );
  const found = matches[0];
  if (found && found.status !== 'active')
    throw Error(`«${name}» غیرفعال است؛ خودکار فعال نمی‌شود.`);
  return found;
}

type PackRow = {
  hotelId: string;
  brokerId: string;
  base: string;
  currency: BulkGroup['currency'];
  factors: Record<string, string>;
  roomRates: {
    roomTypeId: string;
    factor: string;
    maxAdults: number;
    maxChildren2To6: number;
    maxChildren6To12: number;
    maxInfants: number;
    occupancyRates: HotelOccupancyRateV1[];
  }[];
};
export type BulkPack = {
  branchId: string;
  cityId: string;
  checkIn: string;
  checkOut: string;
  currency: BulkGroup['currency'];
  method: 'STAY';
  rows: PackRow[];
};
export function buildBulkPacks(
  plan: ReturnType<typeof planOccupancyBatch>,
  branchId: string,
  cityId: string,
  brokerId: string,
  hotels: ReadonlyMap<string, string>,
  rooms: ReadonlyMap<string, string>,
) {
  const packs: BulkPack[] = [];
  for (const group of plan.groups) {
    const blank = (): BulkPack => ({
      branchId,
      cityId,
      checkIn: group.checkIn,
      checkOut: group.checkOut,
      currency: group.currency,
      method: 'STAY',
      rows: [],
    });
    let pack = blank();
    for (const [name, hotelRooms] of [...group.hotels.entries()].sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      const hotelId = hotels.get(name);
      if (!hotelId) throw Error(`شناسه هتل ${name} پیدا نشد.`);
      const row: PackRow = {
        hotelId,
        brokerId,
        base: '1',
        currency: group.currency,
        factors: {},
        roomRates: [...hotelRooms.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([roomName, rates]) => {
            const roomTypeId = rooms.get(roomName);
            if (!roomTypeId) throw Error(`شناسه اتاق ${roomName} پیدا نشد.`);
            return {
              roomTypeId,
              factor: '1',
              maxAdults: Math.max(...rates.map((r) => r.adults)),
              maxChildren2To6: Math.max(
                ...rates.map((r) => r.childAges.length),
              ),
              maxChildren6To12: 0,
              maxInfants: 0,
              occupancyRates: [...rates].sort((a, b) =>
                JSON.stringify(a).localeCompare(JSON.stringify(b)),
              ),
            };
          }),
      };
      const bytes = (value: BulkPack) =>
        new TextEncoder().encode(JSON.stringify(value)).byteLength;
      if (bytes({ ...blank(), rows: [row] }) > 85000)
        throw Error(
          `نرخ‌های هتل ${name} در یک بازه از سقف درخواست بیشتر است؛ فایل را تفکیک کنید.`,
        );
      if (
        pack.rows.length === 50 ||
        bytes({ ...pack, rows: [...pack.rows, row] }) > 85000
      ) {
        packs.push(pack);
        pack = blank();
      }
      pack.rows.push(row);
    }
    if (pack.rows.length) packs.push(pack);
  }
  if (packs.length > 5000)
    throw Error('تعداد بسته‌ها بیش از سقف نمایش است؛ فایل را تفکیک کنید.');
  return packs;
}

// Same actor + canonical payload reuse the existing API replay key after uncertain responses/reloads.
export async function bulkOperationKey(actorId: string, pack: BulkPack) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify([actorId, pack])),
    ),
  ).slice(0, 16);
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const value = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
