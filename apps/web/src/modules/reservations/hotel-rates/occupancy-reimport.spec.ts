import { expect, it } from 'vitest';
import { savedPack } from './existing-packs.fixture';
import type { BulkPack } from './occupancy-bulk';
import type { PackDetail } from './packs-workspace';
import { planOccupancyReimport } from './occupancy-reimport';
const rate = {
  adults: 2,
  childAges: [],
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-11-01',
  amount: '100',
  currencyCode: 'EUR',
  composition: 'DBL',
  board: 'BB',
};
const incoming = (): BulkPack => ({
  branchId: 'branch',
  cityId: 'city',
  checkIn: rate.startsOn,
  checkOut: rate.endsOnExclusive,
  currency: 'EUR',
  method: 'STAY',
  rows: [
    {
      hotelId: 'hotel',
      brokerId: 'broker',
      base: '1',
      currency: 'EUR',
      factors: {},
      roomRates: [
        {
          roomTypeId: 'room',
          factor: '1',
          maxAdults: 2,
          maxChildren2To6: 0,
          maxChildren6To12: 0,
          maxInfants: 0,
          occupancyRates: [rate],
        },
      ],
    },
  ],
});
const stored = (): PackDetail => ({
  ...savedPack(),
  ...incoming(),
  tourDepartureId: null,
  id: 'pack',
  version: 7,
  batchId: 'batch',
  cityName: 'CITY',
  rows: incoming().rows.map((r) => ({
    ...r,
    factors: {
      double: '',
      single: '',
      triple: '',
      doubleChild: '',
      doubleTwoChildren: '',
      family: '',
    },
    hotelName: 'HOTEL',
    brokerName: 'BROKER',
    roomRates: r.roomRates.map((room) => ({
      ...room,
      roomTypeName: 'ROOM',
      maxChildren: 0,
    })),
  })),
});
it('updates existing IDs/version and never creates a duplicate for changed prices', () => {
  const pack = incoming();
  pack.rows[0]!.roomRates[0]!.occupancyRates[0] = { ...rate, amount: '235.2' };
  const commands = planOccupancyReimport([pack], [stored()]);
  expect(commands).toHaveLength(1);
  expect(commands[0]).toMatchObject({
    id: 'pack',
    unchanged: false,
    body: { expectedVersion: 7 },
  });
  expect(
    commands[0]!.body.rows[0]!.roomRates[0]!.occupancyRates[0]!.amount,
  ).toBe('235.2');
});
it('skips unchanged reimports while preserving missing hotels and other compositions', () => {
  expect(planOccupancyReimport([incoming()], [stored()])[0]!.unchanged).toBe(
    true,
  );
  const existing = stored();
  existing.rows.push({ ...existing.rows[0]!, hotelId: 'other' });
  existing.rows[0]!.roomRates[0]!.occupancyRates!.push({
    ...rate,
    adults: 1,
    amount: '80',
    composition: 'SINGLE',
  });
  const command = planOccupancyReimport([incoming()], [existing])[0]!;
  expect(command.unchanged).toBe(true);
  expect(command.body.rows).toHaveLength(2);
  expect(command.body.rows[0]!.roomRates[0]!.occupancyRates).toHaveLength(2);
});
it('does not update different suppliers, cities, branches, dates, boards or tour packs', () => {
  for (const change of [
    { cityId: 'other' },
    { branchId: 'other' },
    { checkIn: '2026-09-01' },
    { tourDepartureId: 'tour' },
  ]) {
    expect(
      planOccupancyReimport([incoming()], [{ ...stored(), ...change }])[0]!.id,
    ).toBeUndefined();
  }
  const otherBroker = stored();
  otherBroker.rows[0]!.brokerId = 'other';
  expect(
    planOccupancyReimport([incoming()], [otherBroker])[0]!.id,
  ).toBeUndefined();
  const otherBoard = stored();
  otherBoard.rows[0]!.roomRates[0]!.occupancyRates = [{ ...rate, board: 'AI' }];
  expect(
    planOccupancyReimport([incoming()], [otherBoard])[0]!.id,
  ).toBeUndefined();
});
it('fails closed on ambiguous existing duplicate packages', () => {
  expect(() =>
    planOccupancyReimport(
      [incoming()],
      [stored(), { ...stored(), id: 'duplicate' }],
    ),
  ).toThrow('چند بسته');
});
