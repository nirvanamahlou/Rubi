import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import { HotelPurchaseRatesPublicService } from './hotel-purchase-rates.public';

describe('Reservations hotel purchase public projection', () => {
  it('limits rates to the requested branch, tour hotels and stay window', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'batch-1',
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
    expect(await service.forTour('branch-1', [], '2026-10-01', '2026-10-06'))
      .toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
