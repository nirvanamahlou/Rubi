import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { HotelRatePacksService } from './hotel-rate-packs.service';
import { HotelPurchaseRatesPublicService } from './hotel-purchase-rates.public';
const tariff = {
  adults: 2,
  childAges: [{ min: 3, maxExclusive: 7 }],
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-11-01',
  amount: '123.4567',
  currencyCode: 'EUR',
  board: 'BB',
  composition: '2 AD + 1 CHD',
};
const manualTariff = {
  ...tariff,
  amount: '200.00',
  saleAmount: '220.00',
  manualPricing: {
    baseAmount: '100',
    coefficient: '2',
    adjustment: { kind: 'PERCENT', value: '10' },
  },
};
const setup = (selectedTariff = tariff) => {
  const branchId = randomUUID(),
    hotelId = randomUUID(),
    roomTypeId = randomUUID();
  const raw = {
    branchId,
    cityId: randomUUID(),
    checkIn: tariff.startsOn,
    checkOut: tariff.endsOnExclusive,
    currency: 'EUR',
    method: 'STAY',
    rows: [
      {
        hotelId,
        brokerId: randomUUID(),
        base: '1',
        roomRates: [
          {
            roomTypeId,
            factor: '1',
            maxAdults: 2,
            maxChildren: 1,
            occupancyRates: [selectedTariff],
          },
        ],
      },
    ],
  };
  const actor = {
    userId: randomUUID(),
    branchIds: [branchId],
    permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
  } as unknown as AuthenticatedActor;
  const directory = {
    cityReference: vi.fn(),
    hotelRatePackReference: vi.fn().mockResolvedValue({
      hotelName: 'Synthetic Hotel',
      brokerName: 'Synthetic Broker',
      roomTypes: [{ id: roomTypeId, name: 'Standard' }],
    }),
  };
  return { raw, actor, directory, roomTypeId };
};
describe('versioned occupancy persistence and consumer compatibility', () => {
  it.each([tariff, manualTariff])(
    'persists exact tariffs and manual metadata in audited atomic create and replay',
    async (selectedTariff) => {
      const { raw, actor, directory } = setup(selectedTariff);
      const findUnique = vi.fn().mockResolvedValue(null),
        batch = vi.fn().mockResolvedValue({ id: randomUUID() });
      const tx = {
        reservationHotelRatePack: { create: vi.fn() },
        reservationHotelRateBatch: { create: batch },
        auditEvent: { create: vi.fn() },
      };
      const transaction = vi.fn(async (f) => f(tx));
      const service = new HotelRatePacksService(
        {
          client: {
            reservationHotelRateBatch: { findUnique },
            $transaction: transaction,
          },
        } as unknown as DatabaseService,
        directory as unknown as MasterTravelDirectory,
      );
      const key = randomUUID(),
        result = await service.create(raw, key, actor);
      const data = batch.mock.calls[0]![0].data;
      expect(data.rows.create[0].roomRates.create[0].occupancyRates).toEqual([
        selectedTariff,
      ]);
      findUnique.mockResolvedValue({
        ...result,
        packId: result.id,
        fingerprint: data.fingerprint,
        id: result.batchId,
      });
      expect((await service.create(raw, key, actor)).idempotentReplay).toBe(
        true,
      );
      expect(transaction).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects an old editor dropping existing tariffs before any database write', async () => {
    const { raw, actor, directory, roomTypeId } = setup();
    const id = randomUUID();
    const transaction = vi.fn();
    const pack = {
      id,
      branchId: raw.branchId,
      currentVersion: 1,
      versions: [
        {
          rows: [
            {
              hotelId: raw.rows[0]!.hotelId,
              roomRates: [{ roomTypeId, occupancyRates: [tariff] }],
            },
          ],
        },
      ],
    };
    const db = {
      client: {
        reservationHotelRateBatch: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        reservationHotelRatePack: {
          findFirst: vi.fn().mockResolvedValue(pack),
        },
        $transaction: transaction,
      },
    };
    const service = new HotelRatePacksService(
      db as unknown as DatabaseService,
      directory as unknown as MasterTravelDirectory,
    );
    const old = {
      ...raw,
      expectedVersion: 1,
      rows: raw.rows.map((r) => ({
        ...r,
        roomRates: r.roomRates.map(({ occupancyRates, ...room }) => {
          void occupancyRates;
          return room;
        }),
      })),
    };
    await expect(service.update(id, old, randomUUID(), actor)).rejects.toThrow(
      'حفظ',
    );
    expect(transaction).not.toHaveBeenCalled();
    const legacy = {
      ...raw,
      expectedVersion: 1,
      rows: raw.rows.map(({ roomRates, ...r }) => {
        void roomRates;
        return { ...r, factors: { double: '1' } };
      }),
    };
    await expect(
      service.update(id, legacy, randomUUID(), actor),
    ).rejects.toThrow('قدیمی');
    expect(transaction).not.toHaveBeenCalled();
  });
  it.each([tariff, manualTariff])(
    'projects full occupancy and manual metadata to Sales but excludes nominal factors from tour pricing',
    async (selectedTariff) => {
      const room = {
        roomTypeId: 'standard',
        roomTypeName: 'Standard',
        factor: 1,
        maxAdults: 2,
        maxChildren: 1,
        maxChildren2To6: 1,
        maxChildren6To12: 0,
        maxInfants: 0,
        occupancyRates: [selectedTariff],
      };
      const fixture = {
        id: 'batch',
        branchId: 'branch',
        version: 1,
        pack: null,
        checkIn: new Date(tariff.startsOn),
        checkOut: new Date(tariff.endsOnExclusive),
        currency: 'EUR',
        method: 'STAY',
        createdAt: new Date(),
        rows: [
          {
            id: 'row',
            batchId: 'batch',
            hotelId: 'hotel',
            hotelName: 'Synthetic',
            brokerId: 'broker',
            brokerName: 'Synthetic',
            base: 1,
            currency: 'EUR',
            factors: { double: '1' },
            roomRates: [room],
          },
        ],
      };
      const service = new HotelPurchaseRatesPublicService({
        client: {
          reservationHotelRateBatch: {
            findMany: vi.fn().mockResolvedValue([fixture]),
          },
        },
      } as unknown as DatabaseService);
      expect(
        (
          await service.forTour(
            'branch',
            ['hotel'],
            tariff.startsOn,
            tariff.endsOnExclusive,
          )
        )[0]?.rows,
      ).toEqual([]);
      expect(
        (
          await service.availableRoomRates({
            branchId: 'branch',
            hotelId: 'hotel',
            checkIn: tariff.startsOn,
            checkOut: tariff.endsOnExclusive,
          })
        )[0]?.occupancyRates,
      ).toEqual([selectedTariff]);
    },
  );
});
