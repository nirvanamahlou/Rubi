import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { MasterDataRecord } from '@nora/contracts';
import {
  buildBulkPacks,
  bulkOperationKey,
  exactReference,
  planOccupancyBatch,
  resolveRoomPrices,
  reviewOccupancyBatch,
} from './occupancy-bulk';
import type { ImportedOccupancy } from './occupancy-import';
const row = (extra: Partial<ImportedOccupancy> = {}): ImportedOccupancy => ({
  hotel: 'HOTEL',
  room: 'STANDARD',
  capacity: '2 AD + 2 CHD',
  sourceRow: 2,
  adults: 2,
  childAges: [{ min: 3, maxExclusive: 7 }],
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-11-01',
  currencyCode: 'EUR',
  amount: '123.456789012345',
  composition: '2 AD + 1 CHD',
  board: 'BB',
  ...extra,
});
const build = (rows: ImportedOccupancy[]) => {
  const plan = planOccupancyBatch(rows);
  return buildBulkPacks(
    plan,
    'branch',
    'city',
    'broker',
    new Map([...plan.hotelNames].map((n) => [n, n.padEnd(36, 'h')])),
    new Map([...plan.capacities.keys()].map((n) => [n, n.padEnd(36, 'r')])),
  );
};
describe('whole-file occupancy registration plan', () => {
  it('prefers explicit guest prices to ROOM without leaking across guest/board/date boundaries', () => {
    const room = row({ composition: 'ROOM', amount: '84' });
    const explicit = row({
      composition: '2 AD',
      amount: '235.2',
      startsOn: '2026-10-10',
      endsOnExclusive: '2026-10-20',
      sourceRow: 3,
    });
    const result = resolveRoomPrices([room, explicit]);
    expect(result.overriddenRooms).toBe(1);
    expect(
      result.rows
        .filter((r) => r.composition === 'ROOM')
        .map((r) => [r.startsOn, r.endsOnExclusive]),
    ).toEqual([
      ['2026-10-01', '2026-10-10'],
      ['2026-10-20', '2026-11-01'],
    ]);
    expect(result.rows.find((r) => r.composition === '2 AD')?.amount).toBe(
      '235.2',
    );
    expect(
      resolveRoomPrices([room, { ...explicit, board: 'AI' }]).overriddenRooms,
    ).toBe(0);
    expect(
      resolveRoomPrices([room, { ...explicit, adults: 3 }]).overriddenRooms,
    ).toBe(0);
  });
  it('reports both conflicting rows and preserves unrelated correct tariffs', () => {
    const reviewed = reviewOccupancyBatch([
      row(),
      row({ sourceRow: 3, amount: '456', startsOn: '2026-10-10' }),
      row({ sourceRow: 4, hotel: 'OTHER' }),
    ]);
    expect(reviewed.issues).toHaveLength(2);
    expect(reviewed.rows.map((r) => r.sourceRow)).toEqual([4]);
    expect(() =>
      planOccupancyBatch([
        row(),
        row({ sourceRow: 3, amount: '456', startsOn: '2026-10-10' }),
      ]),
    ).toThrow('متعارض');
  });
  it('keeps every hotel, room, exact amount, child band and original date automatically', () => {
    const rows = [
      row(),
      row({ hotel: 'OTHER', room: 'SUITE' }),
      row({
        startsOn: '2026-11-01',
        endsOnExclusive: '2026-12-01',
        amount: '150',
      }),
      row({ board: 'AI' }),
      row({ currencyCode: 'USD' }),
    ];
    const packs = build(rows);
    expect(packs).toHaveLength(4);
    const rates = packs.flatMap((p) =>
      p.rows.flatMap((h) => h.roomRates.flatMap((r) => r.occupancyRates)),
    );
    expect(rates).toHaveLength(rows.length);
    expect(rates).toContainEqual(
      expect.objectContaining({
        amount: rows[0]!.amount,
        childAges: [{ min: 3, maxExclusive: 7 }],
        startsOn: '2026-10-01',
        endsOnExclusive: '2026-11-01',
      }),
    );
    expect(
      packs.every(
        (p) =>
          p.method === 'STAY' &&
          p.rows.every((h) => Object.keys(h.factors).length === 0),
      ),
    ).toBe(true);
  });
  it('splits batches at 50 hotels and never drops later hotels', () => {
    const packs = build(
      Array.from({ length: 121 }, (_, n) => row({ hotel: `HOTEL ${n}` })),
    );
    expect(packs.map((p) => p.rows.length)).toEqual([50, 50, 21]);
  });
  it('rejects precision conflicts without binary Number rounding', () => {
    expect(() =>
      build([
        row({ amount: '999999999999.111111111111' }),
        row({ amount: '999999999999.111111111112' }),
      ]),
    ).toThrow('متعارض');
    expect(build([row({ amount: '1.00' }), row({ amount: '1' })])).toHaveLength(
      1,
    );
  });
  it('fails closed for unsupported currency and duplicate normalized source names', () => {
    expect(() => build([row({ currencyCode: 'TRY' })])).toThrow('پشتیبانی');
    expect(build([row(), row({ hotel: 'hotel ' })])[0]!.rows).toHaveLength(1);
  });
  it('never silently truncates an oversized hotel request', () => {
    expect(() =>
      build(
        Array.from({ length: 900 }, (_, n) =>
          row({ adults: 1, composition: `SINGLE ${n}` }),
        ),
      ),
    ).toThrow('سقف درخواست');
  });
  it('rejects inactive and ambiguous Master Data references', () => {
    const record = {
      id: 'id',
      name: 'HOTEL',
      status: 'active',
      attributes: {},
    } as MasterDataRecord;
    expect(exactReference([record], 'hotel')).toBe(record);
    expect(() =>
      exactReference([record, { ...record, id: 'other' }], 'HOTEL'),
    ).toThrow('چند رکورد');
    expect(() =>
      exactReference([{ ...record, status: 'inactive' }], 'HOTEL'),
    ).toThrow('غیرفعال');
  });
  it('keeps replay keys stable after reordered Excel rows and changes them for changed prices/actor', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });
    const a = row(),
      b = row({ hotel: 'OTHER' });
    const key = await bulkOperationKey('actor', build([a, b])[0]!);
    expect(key).toMatch(/^[a-f0-9-]{14}5[a-f0-9-]{21}$/);
    expect(await bulkOperationKey('actor', build([b, a])[0]!)).toBe(key);
    expect(await bulkOperationKey('other', build([a, b])[0]!)).not.toBe(key);
    expect(
      await bulkOperationKey('actor', build([{ ...a, amount: '200' }, b])[0]!),
    ).not.toBe(key);
  });
});
