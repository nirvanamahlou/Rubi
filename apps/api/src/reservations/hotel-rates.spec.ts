import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@rubi/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { HotelRatesService } from './hotel-rates.module';
import {
  validateRateBatch,
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
    expect(() => validateRateBatch({ ...data, currency: 'IRR' })).toThrow();
    expect(() =>
      validateRateBatch({ ...data, rows: [...data.rows, ...data.rows] }),
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
