import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { roomKinds } from './hotel-rates.validation';
import { HotelRatePacksService } from './hotel-rate-packs.service';
import type { TourPublicService } from '../ticket-catalog/tour-public.service';

const input = () => ({
  branchId: randomUUID(),
  cityId: randomUUID(),
  checkIn: '2026-10-01',
  checkOut: '2026-10-06',
  currency: 'EUR',
  method: 'STAY',
  rows: [
    {
      hotelId: randomUUID(),
      brokerId: randomUUID(),
      base: '125.00',
      currency: 'EUR',
      factors: Object.fromEntries(roomKinds.map((kind) => [kind, '1'])),
    },
  ],
});
const actor = (branchId: string) =>
  ({
    permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
    branchIds: [branchId],
    userId: randomUUID(),
  }) as unknown as AuthenticatedActor;

describe('versioned Reservations hotel rate packs', () => {
  it('rejects a hotel stay outside its selected departure before writing rates', async () => {
    const data = { ...input(), tourDepartureId: randomUUID() };
    const tour = {
      branchId: data.branchId,
      package: { destinationId: data.cityId },
      startsOn: '2026-10-02',
      endsOn: '2026-10-06',
    };
    const tours = { pricingDeparture: vi.fn().mockResolvedValue(tour) };
    const transaction = vi.fn();
    const service = new HotelRatePacksService(
      {
        client: {
          reservationHotelRateBatch: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
          $transaction: transaction,
        },
      } as unknown as DatabaseService,
      {} as MasterTravelDirectory,
      tours as unknown as TourPublicService,
    );
    await expect(
      service.create(data, randomUUID(), actor(data.branchId)),
    ).rejects.toThrow('شهر و بازه');
    expect(tours.pricingDeparture).toHaveBeenCalledWith(data.tourDepartureId, [
      data.branchId,
    ]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('persists the departure on the pack and immutable batch with independent row currencies', async () => {
    const data = { ...input(), tourDepartureId: randomUUID() };
    const createPack = vi.fn().mockResolvedValue({});
    const createBatch = vi.fn().mockResolvedValue({ id: randomUUID() });
    const tx = {
      reservationHotelRatePack: { create: createPack },
      reservationHotelRateBatch: { create: createBatch },
      auditEvent: { create: vi.fn() },
    };
    const service = new HotelRatePacksService(
      {
        client: {
          reservationHotelRateBatch: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
          $transaction: vi.fn(async (run) => run(tx)),
        },
      } as unknown as DatabaseService,
      {
        cityReference: vi.fn(),
        hotelRatePackReference: vi
          .fn()
          .mockResolvedValue({
            hotelName: 'Antalya hotel',
            brokerName: 'Broker',
          }),
      } as unknown as MasterTravelDirectory,
      {
        pricingDeparture: vi
          .fn()
          .mockResolvedValue({
            package: { destinationId: data.cityId },
            startsOn: data.checkIn,
            endsOn: data.checkOut,
          }),
      } as unknown as TourPublicService,
    );
    await service.create(data, randomUUID(), actor(data.branchId));
    expect(createPack.mock.calls[0]![0].data.tourDepartureId).toBe(
      data.tourDepartureId,
    );
    expect(createBatch.mock.calls[0]![0].data.tourDepartureId).toBe(
      data.tourDepartureId,
    );
    expect(createBatch.mock.calls[0]![0].data.rows.create[0].currency).toBe(
      'EUR',
    );
  });
  it('rejects an unauthorized branch before Master Data lookup or database access', async () => {
    const directory = {
      cityReference: vi.fn(),
      hotelRatePackReference: vi.fn(),
    };
    const findUnique = vi.fn();
    const service = new HotelRatePacksService(
      {
        client: { reservationHotelRateBatch: { findUnique } },
      } as unknown as DatabaseService,
      directory as unknown as MasterTravelDirectory,
    );
    await expect(
      service.create(input(), randomUUID(), actor(randomUUID())),
    ).rejects.toThrow();
    expect(directory.cityReference).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects stale edit versions without creating a new batch', async () => {
    const data = input();
    const packId = randomUUID();
    const directory = {
      cityReference: vi.fn(),
      hotelRatePackReference: vi.fn(),
    };
    const findUnique = vi.fn().mockResolvedValue(null);
    const findFirst = vi.fn().mockResolvedValue({
      id: packId,
      branchId: data.branchId,
      currentVersion: 2,
    });
    const transaction = vi.fn();
    const service = new HotelRatePacksService(
      {
        client: {
          reservationHotelRateBatch: { findUnique },
          reservationHotelRatePack: { findFirst },
          $transaction: transaction,
        },
      } as unknown as DatabaseService,
      directory as unknown as MasterTravelDirectory,
    );
    await expect(
      service.update(
        packId,
        { ...data, expectedVersion: 1 },
        randomUUID(),
        actor(data.branchId),
      ),
    ).rejects.toThrow();
    expect(directory.cityReference).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not expose a pack from a branch outside the actor scope', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new HotelRatePacksService(
      {
        client: {
          reservationHotelRatePack: { findFirst },
        },
      } as unknown as DatabaseService,
      {} as MasterTravelDirectory,
    );
    await expect(
      service.detail(randomUUID(), actor(randomUUID())),
    ).rejects.toThrow();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: expect.any(Object) }),
      }),
    );
  });
});
