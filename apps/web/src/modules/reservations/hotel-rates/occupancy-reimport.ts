import type { HotelOccupancyRateV1 } from '@nora/contracts';
import type { PackDetail } from './packs-workspace';
import type { BulkPack } from './occupancy-bulk';
import { packPriceUpdateBody } from './existing-packs-model';

type Row = BulkPack['rows'][number];
export type ImportCommand = {
  id?: string;
  body: BulkPack & { expectedVersion?: number };
  unchanged?: boolean;
};
const period = (p: BulkPack | PackDetail) =>
  JSON.stringify([
    p.branchId,
    p.cityId,
    p.checkIn,
    p.checkOut,
    p.currency,
    p.method,
  ]);
const shape = (r: HotelOccupancyRateV1) =>
  JSON.stringify([
    r.adults,
    [...r.childAges].sort(
      (a, b) => a.min - b.min || a.maxExclusive - b.maxExclusive,
    ),
    r.board,
    r.startsOn,
    r.endsOnExclusive,
  ]);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
function mergeRow(previous: Row, incoming: Row): Row {
  const rooms = [...previous.roomRates];
  for (const room of incoming.roomRates) {
    const index = rooms.findIndex((r) => r.roomTypeId === room.roomTypeId);
    if (index < 0) {
      rooms.push(room);
      continue;
    }
    const old = rooms[index]!;
    const oldRates = old.occupancyRates ?? [];
    const boards = new Set(
      [...oldRates, ...room.occupancyRates].map((r) => r.board),
    );
    if (boards.size > 1)
      throw Error('بورد متفاوت برای همان اتاق؛ بسته قبلی تغییر نکرد.');
    const replacements = new Set(room.occupancyRates.map(shape));
    const rates = [
      ...oldRates.filter((r) => !replacements.has(shape(r))),
      ...room.occupancyRates,
    ];
    if (rates.length > 2000)
      throw Error('تعداد نرخ اتاق پس از به‌روزرسانی بیش از حد مجاز است.');
    rooms[index] = {
      ...old,
      occupancyRates: rates,
      maxAdults: Math.max(old.maxAdults, room.maxAdults),
      maxChildren2To6: Math.max(old.maxChildren2To6, room.maxChildren2To6),
      maxChildren6To12: Math.max(old.maxChildren6To12, room.maxChildren6To12),
      maxInfants: Math.max(old.maxInfants, room.maxInfants),
    };
  }
  if (rooms.length > 30)
    throw Error('تعداد انواع اتاق پس از به‌روزرسانی بیش از حد مجاز است.');
  return { ...previous, roomRates: rooms };
}

/** Existing pack IDs, not importer chunk boundaries, determine updates. */
export function planOccupancyReimport(
  incoming: readonly BulkPack[],
  existing: readonly PackDetail[],
) {
  const targets = new Map<string, PackDetail[]>();
  const originals = new Map<string, BulkPack & { expectedVersion: number }>();
  for (const pack of existing) {
    if (pack.tourDepartureId || pack.method !== 'STAY') continue;
    originals.set(pack.id, JSON.parse(packPriceUpdateBody(pack)));
    for (const row of pack.rows) {
      const boards = new Set(
        row.roomRates.flatMap(
          (r) => r.occupancyRates?.map((rate) => rate.board) ?? [],
        ),
      );
      for (const board of boards) {
        const key = JSON.stringify([
          period(pack),
          row.hotelId,
          row.brokerId,
          board,
        ]);
        const matches = targets.get(key) ?? [];
        matches.push(pack);
        targets.set(key, matches);
      }
    }
  }
  const updates = new Map<string, ImportCommand>();
  const creates: ImportCommand[] = [];
  for (const pack of incoming) {
    const newRows: Row[] = [];
    for (const row of pack.rows) {
      const boards = new Set(
        row.roomRates.flatMap((r) =>
          r.occupancyRates.map((rate) => rate.board),
        ),
      );
      if (boards.size !== 1) throw Error('بورد ورودی بسته یکتا نیست.');
      const key = JSON.stringify([
        period(pack),
        row.hotelId,
        row.brokerId,
        [...boards][0],
      ]);
      const matches = targets.get(key) ?? [];
      if (matches.length > 1)
        throw Error(
          'برای یک هتل، کارگزار و بازه چند بسته موجود است؛ پیش از آپدیت، بسته‌های تکراری را بررسی کنید.',
        );
      const target = matches[0];
      if (!target) {
        newRows.push(row);
        continue;
      }
      let command = updates.get(target.id);
      if (!command) {
        command = {
          id: target.id,
          body: structuredClone(originals.get(target.id)!),
        };
        updates.set(target.id, command);
      }
      const index = command.body.rows.findIndex(
        (r) => r.hotelId === row.hotelId && r.brokerId === row.brokerId,
      );
      if (index < 0)
        throw Error('تطبیق بسته موجود کامل نیست؛ آپدیت انجام نشد.');
      command.body.rows[index] = mergeRow(command.body.rows[index]!, row);
    }
    if (newRows.length) creates.push({ body: { ...pack, rows: newRows } });
  }
  for (const command of updates.values()) {
    if (
      new TextEncoder().encode(JSON.stringify(command.body)).byteLength > 90000
    )
      throw Error(
        'حجم بسته پس از به‌روزرسانی بیش از حد مجاز است؛ ثبت انجام نشد.',
      );
    command.unchanged =
      canonical(command.body) === canonical(originals.get(command.id!)!);
  }
  return [...updates.values(), ...creates];
}
