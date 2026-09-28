import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { HotelPurchaseRatesPublicService } from './hotel-purchase-rates.public';

describe('Reservations hotel purchase public projection', () => {
  it('uses the exact departure even when its hotel choices were entered in the rate pack', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new HotelPurchaseRatesPublicService({
      client: { reservationHotelRateBatch: { findMany } },
    } as unknown as DatabaseService);
    await service.forTour(
      'branch-1',
      [],
      '2026-10-01',
      '2026-10-06',
      'departure-1',
    );
    const query = findMany.mock.calls[0]![0];
    expect(query.where).toEqual({
      branchId: 'branch-1',
      tourDepartureId: 'departure-1',
    });
    expect(query.include.rows.where).toBeUndefined();
  });
  it('limits rates to the requested branch, tour hotels and stay window', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'batch-1',
        version: 1,
        pack: null,
        branchId: 'branch-1',
        checkIn: new Date('2026-10-01T00:00:00.000Z'),
        checkOut: new Date('2026-10-06T00:00:00.000Z'),
        method: 'STAY',
        currency: 'EUR',
        createdAt: new Date('2026-09-15T00:00:00.000Z'),
        rows: [
          {
            id: 'rate-1',
            batchId: 'batch-1',
            hotelId: 'hotel-1',
            hotelName: 'Hotel 1',
            brokerId: 'broker-1',
            brokerName: 'Broker 1',
            base: { toString: () => '125.5' },
            factors: { double: '1', single: '1.5' },
          },
        ],
      },
    ]);
    const database = {
      client: { reservationHotelRateBatch: { findMany } },
    } as unknown as DatabaseService;
    const service = new HotelPurchaseRatesPublicService(database);
    const rows = await service.forTour(
      'branch-1',
      ['hotel-1'],
      '2026-10-01',
      '2026-10-06',
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'branch-1',
          rows: { some: { hotelId: { in: ['hotel-1'] } } },
        }),
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'batch-1',
        currencyCode: 'EUR',
        rows: [
          expect.objectContaining({
            id: 'rate-1',
            basePerNight: '125.5',
            hotelId: 'hotel-1',
          }),
        ],
      }),
    ]);
  });

  it('does not query rates for a tour without hotels', async () => {
    const findMany = vi.fn();
    const database = {
      client: { reservationHotelRateBatch: { findMany } },
    } as unknown as DatabaseService;
    const service = new HotelPurchaseRatesPublicService(database);
    expect(
      await service.forTour('branch-1', [], '2026-10-01', '2026-10-06'),
    ).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('treats an unloaded rate-row relation as an empty public projection', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'batch-without-rows',
        version: 1,
        pack: null,
        branchId: 'branch-1',
        checkIn: new Date('2026-10-01T00:00:00.000Z'),
        checkOut: new Date('2026-10-06T00:00:00.000Z'),
        method: 'STAY',
        currency: 'EUR',
        createdAt: new Date('2026-09-15T00:00:00.000Z'),
      },
    ]);
    const service = new HotelPurchaseRatesPublicService({
      client: { reservationHotelRateBatch: { findMany } },
    } as unknown as DatabaseService);

    await expect(
      service.forTour('branch-1', ['hotel-1'], '2026-10-01', '2026-10-06'),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'batch-without-rows', rows: [] }),
    ]);
  });

  it('exposes only the current version of an edited rate pack', async () => {
    const common = {
      branchId: 'branch-1',
      checkIn: new Date('2026-10-01T00:00:00.000Z'),
      checkOut: new Date('2026-10-06T00:00:00.000Z'),
      method: 'STAY',
      currency: 'EUR',
      createdAt: new Date('2026-09-15T00:00:00.000Z'),
      rows: [],
      pack: { currentVersion: 2 },
    };
    const findMany = vi.fn().mockResolvedValue([
      { ...common, id: 'new-batch', version: 2 },
      { ...common, id: 'old-batch', version: 1 },
    ]);
    const service = new HotelPurchaseRatesPublicService({
      client: { reservationHotelRateBatch: { findMany } },
    } as unknown as DatabaseService);
    const result = await service.forTour(
      'branch-1',
      ['hotel-1'],
      '2026-10-01',
      '2026-10-06',
    );
    expect(result.map((item) => item.id)).toEqual(['new-batch']);
  });
});

it('finds independent city rates for a departure without restricting to its id', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const service = new HotelPurchaseRatesPublicService({
    client: { reservationHotelRateBatch: { findMany } },
  } as unknown as DatabaseService);
  await service.forTour(
    'branch-1',
    [],
    '2026-10-01',
    '2026-10-06',
    'departure-1',
    'city-1',
  );
  const query = findMany.mock.calls[0]![0];
  expect(query.where.cityId).toBe('city-1');
  expect(query.where.branchId).toBe('branch-1');
  expect(query.where.tourDepartureId).toBeUndefined();
  expect(query.where.OR).toEqual([
    {
      method: 'CHECK_IN',
      checkIn: { lte: new Date('2026-10-01T00:00:00Z') },
      checkOut: { gt: new Date('2026-10-01T00:00:00Z') },
    },
    {
      method: 'STAY',
      checkIn: { lte: new Date('2026-10-01T00:00:00Z') },
      checkOut: { gte: new Date('2026-10-06T00:00:00Z') },
    },
  ]);
});
