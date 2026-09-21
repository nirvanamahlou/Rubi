import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { HotelRatesService } from './hotel-rates.module';
import {
  validateRateBatch,
  validateRatePack,
  roomPrices,
  roomKinds,
} from './hotel-rates.validation';
const input = () => ({
  branchId: randomUUID(),
  checkIn: '2026-10-01',
  checkOut: '2026-10-05',
  currency: 'EUR',
  method: 'CHECK_IN',
  rows: [
    {
      hotelId: randomUUID(),
      brokerId: randomUUID(),
      base: '10.05',
      currency: 'EUR',
      factors: Object.fromEntries(roomKinds.map((k) => [k, '1.5'])),
    },
  ],
});
describe('group hotel rate integrity', () => {
  it('rounds monetary products half up without floating point drift', () =>
    expect(
      roomPrices(
        '10.05',
        Object.fromEntries(roomKinds.map((k) => [k, '1.5'])) as never,
        'EUR',
      ).double,
    ).toBe('15.08'));
  it.each(['2026-02-30', 'not-date', '2026-10-06'])(
    'rejects invalid or reversed arrival %s',
    (date) =>
      expect(() => validateRateBatch({ ...input(), checkIn: date })).toThrow(),
  );
  it.each(['-1', '0', '1e5', '1.234', 'NaN'])('rejects base %s', (base) => {
    const data = input();
    data.rows[0]!.base = base;
    expect(() => validateRateBatch(data)).toThrow();
  });
  it('rejects fractional rials and duplicate hotel/broker rows', () => {
    const data = input();
    data.rows[0]!.currency = 'IRR';
    expect(() => validateRateBatch(data)).toThrow();
    expect(() =>
      validateRateBatch({ ...data, rows: [...data.rows, ...data.rows] }),
    ).toThrow();
  });
  it('requires a city and only one selected rate for each hotel in a pack', () => {
    const cityId = randomUUID();
    const data = input();
    expect(() => validateRatePack(data)).toThrow();
    const valid = validateRatePack({ ...data, cityId });
    expect(valid.cityId).toBe(cityId);
    expect(() =>
      validateRatePack({
        ...data,
        cityId,
        rows: [data.rows[0], { ...data.rows[0], brokerId: randomUUID() }],
      }),
    ).toThrow();
  });
  it('accepts 2+1 and 2+3 capacities and rejects unavailable or duplicate room rates', () => {
    const data = input();
    const roomTypeA = randomUUID();
    const roomTypeB = randomUUID();
    const pack = {
      ...data,
      cityId: randomUUID(),
      rows: [
        {
          ...data.rows[0],
          factors: undefined,
          roomRates: [
            {
              roomTypeId: roomTypeA,
              factor: '1.2',
              maxAdults: 2,
              maxChildren: 1,
            },
            {
              roomTypeId: roomTypeB,
              factor: '1.8',
              maxAdults: 2,
              maxChildren: 3,
            },
          ],
        },
      ],
    };
    expect(validateRatePack(pack).rows[0]?.roomRates).toMatchObject([
      { maxAdults: 2, maxChildren: 1 },
      { maxAdults: 2, maxChildren: 3 },
    ]);
    expect(() =>
      validateRatePack({ ...pack, rows: [{ ...pack.rows[0], roomRates: [] }] }),
    ).toThrow();
    expect(() =>
      validateRatePack({
        ...pack,
        rows: [
          {
            ...pack.rows[0],
            roomRates: [
              pack.rows[0]!.roomRates[0],
              { ...pack.rows[0]!.roomRates[1], roomTypeId: roomTypeA },
            ],
          },
        ],
      }),
    ).toThrow();
  });
  it('denies unauthorized branch before reference lookup or writes', async () => {
    const directory = { hotelRateReference: vi.fn() };
    const db = {
      client: { reservationHotelRateBatch: { findUnique: vi.fn() } },
    };
    const service = new HotelRatesService(
      db as unknown as DatabaseService,
      directory as unknown as MasterTravelDirectory,
    );
    await expect(
      service.save(input(), randomUUID(), {
        permissions: ['reservations.hotel_purchase.write'],
        branchIds: [],
        userId: randomUUID(),
      } as unknown as AuthenticatedActor),
    ).rejects.toThrow();
    expect(directory.hotelRateReference).not.toHaveBeenCalled();
    expect(
      db.client.reservationHotelRateBatch.findUnique,
    ).not.toHaveBeenCalled();
  });
  it('denies users without purchase permission', async () => {
    const service = new HotelRatesService(
      {} as DatabaseService,
      {} as MasterTravelDirectory,
    );
    await expect(
      service.save(input(), randomUUID(), {
        permissions: [],
      } as unknown as AuthenticatedActor),
    ).rejects.toThrow();
  });
});
