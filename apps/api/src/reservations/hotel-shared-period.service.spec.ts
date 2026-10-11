import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor, HotelRatePeriodV1 } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { HotelRatePacksService } from './hotel-rate-packs.service';

function fixture() {
  const branchId = randomUUID(),
    cityId = randomUUID(),
    hotelId = randomUUID(),
    brokerId = randomUUID(),
    roomTypeId = randomUUID();
  const actor = {
    userId: randomUUID(),
    branchIds: [branchId],
    permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
  } as AuthenticatedActor;
  const source = (
    from: string,
    to: string,
    amount: string,
  ): HotelRatePeriodV1 => ({
    id: randomUUID(),
    batchId: randomUUID(),
    version: 2,
    checkIn: from,
    checkOut: to,
    method: 'STAY',
    rows: [
      {
        hotelId,
        hotelName: 'Hotel',
        brokerId,
        brokerName: 'Broker',
        currency: 'EUR',
        roomRates: [
          {
            roomTypeId,
            roomTypeName: 'Land view',
            factor: '1',
            maxAdults: 2,
            maxChildren: 0,
            occupancyRates: [
              {
                adults: 2,
                childAges: [],
                composition: 'DBL',
                amount,
                saleAmount: amount,
                startsOn: from,
                endsOnExclusive: to,
                currencyCode: 'EUR',
                board: 'BB',
              },
            ],
          },
        ],
      },
    ],
  });
  const periods = [
    source('2027-04-01', '2027-04-22', '100'),
    source('2027-04-22', '2027-05-01', '200'),
  ];
  const tx = {
    reservationHotelRatePack: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ id: 'current' }),
    },
    reservationHotelRateBatch: {
      create: vi.fn().mockResolvedValue({ id: randomUUID() }),
    },
    auditEvent: { create: vi.fn() },
  };
  const client = {
    reservationHotelRateBatch: { findUnique: vi.fn().mockResolvedValue(null) },
    reservationHotelRatePack: { findMany: vi.fn() },
    $transaction: vi.fn(async (run, options?: unknown) => {
      void options;
      return run(tx);
    }),
  };
  const directory = {
    cityReference: vi.fn(),
    hotelRatePackReference: vi.fn().mockResolvedValue({
      hotelName: 'Hotel',
      brokerName: 'Broker',
      roomTypes: [{ id: roomTypeId, name: 'Land view' }],
    }),
  };
  const service = new HotelRatePacksService(
    { client } as unknown as DatabaseService,
    directory as unknown as MasterTravelDirectory,
  );
  const input = {
    branchId,
    cityId,
    checkIn: '2027-04-20',
    checkOut: '2027-04-25',
    selections: [
      {
        key: `${hotelId}:${brokerId}:EUR`,
        sourceBatchIds: periods.map((period) => period.batchId),
      },
    ],
  };
  return { service, input, periods, tx, client, actor, directory };
}

describe('shared hotel period persistence', () => {
  it('copies only selected complete nightly segments and links immutable source batches atomically', async () => {
    const f = fixture();
    vi.spyOn(f.service, 'periods').mockResolvedValue(f.periods);
    await f.service.createShared(f.input, randomUUID(), f.actor);
    expect(
      f.tx.reservationHotelRatePack.create.mock.calls[0]![0].data.sourcePeriods
        .create,
    ).toEqual(f.periods.map((p) => ({ sourceBatchId: p.batchId })));
    const row =
      f.tx.reservationHotelRateBatch.create.mock.calls[0]![0].data.rows
        .create[0];
    expect(
      row.roomRates.create[0].occupancyRates.map(
        (rate: {
          startsOn: string;
          endsOnExclusive: string;
          amount: string;
        }) => [rate.startsOn, rate.endsOnExclusive, rate.amount],
      ),
    ).toEqual([
      ['2027-04-20', '2027-04-22', '100'],
      ['2027-04-22', '2027-04-25', '200'],
    ]);
    expect(f.client.$transaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: 'Serializable',
    });
  });
  it('rejects stale selections and rechecks versions inside the write transaction', async () => {
    const f = fixture();
    vi.spyOn(f.service, 'periods').mockResolvedValue(f.periods);
    const stale = {
      ...f.input,
      selections: [
        { ...f.input.selections[0]!, sourceBatchIds: [randomUUID()] },
      ],
    };
    await expect(
      f.service.createShared(stale, randomUUID(), f.actor),
    ).rejects.toThrow('تغییر');
    expect(f.client.$transaction).not.toHaveBeenCalled();
    f.tx.reservationHotelRatePack.findFirst.mockResolvedValueOnce(null);
    await expect(
      f.service.createShared(f.input, randomUUID(), f.actor),
    ).rejects.toThrow('تغییر');
    expect(f.tx.reservationHotelRateBatch.create).not.toHaveBeenCalled();
  });
  it('rejects missing nights before persisting a partial hotel', async () => {
    const f = fixture();
    f.periods[1]!.rows[0]!.roomRates[0]!.occupancyRates![0]!.startsOn =
      '2027-04-23';
    vi.spyOn(f.service, 'periods').mockResolvedValue(f.periods);
    await expect(
      f.service.createShared(f.input, randomUUID(), f.actor),
    ).rejects.toThrow();
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
  it('checks write and branch permissions before data access, and never accepts client prices', async () => {
    const f = fixture();
    await expect(
      f.service.createShared(f.input, randomUUID(), {
        ...f.actor,
        permissions: ['reservations.read'],
      }),
    ).rejects.toThrow();
    await expect(
      f.service.createShared(
        { ...f.input, branchId: randomUUID() },
        randomUUID(),
        f.actor,
      ),
    ).rejects.toThrow();
    await expect(
      f.service.createShared({ ...f.input, rows: [] }, randomUUID(), f.actor),
    ).rejects.toThrow();
    expect(
      f.client.reservationHotelRateBatch.findUnique,
    ).not.toHaveBeenCalled();
    await expect(
      f.service.periods(f.actor, randomUUID(), f.input.cityId),
    ).rejects.toThrow();
    expect(f.client.reservationHotelRatePack.findMany).not.toHaveBeenCalled();
  });
  it('replays a successful creation before re-reading changed source periods', async () => {
    const f = fixture();
    vi.spyOn(f.service, 'periods').mockResolvedValue(f.periods);
    let saved: unknown;
    f.tx.reservationHotelRateBatch.create.mockImplementation(
      async ({ data }) => {
        saved = { ...data, id: randomUUID() };
        return saved;
      },
    );
    const key = randomUUID();
    const first = await f.service.createShared(f.input, key, f.actor);
    f.client.reservationHotelRateBatch.findUnique.mockResolvedValue(saved);
    const second = await f.service.createShared(f.input, key, f.actor);
    expect(second).toMatchObject({
      id: first.id,
      batchId: first.batchId,
      idempotentReplay: true,
    });
    expect(f.service.periods).toHaveBeenCalledTimes(1);
  });
  it('queries only the authorized city and excludes previously derived packs', async () => {
    const f = fixture();
    f.client.reservationHotelRatePack.findMany.mockResolvedValue([]);
    expect(
      await f.service.periods(f.actor, f.input.branchId, f.input.cityId),
    ).toEqual([]);
    expect(
      f.client.reservationHotelRatePack.findMany.mock.calls[0]![0].where,
    ).toEqual({
      branchId: f.input.branchId,
      cityId: f.input.cityId,
      tourDepartureId: null,
      sourcePeriods: { none: {} },
    });
  });
});
