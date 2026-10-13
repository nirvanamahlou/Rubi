import { describe, expect, it, vi } from 'vitest';
import {
  hotelReferencePurchase,
  ReservationHotelSavingsService,
} from './reservation-hotel-savings.service';
import type {
  PackageTourHotelPurchaseBatchV1,
  SalesReservationRequestV1,
} from '@nora/contracts';
const snapshot = {
  hotelSelection: {
    hotelId: 'hotel',
    roomTypeId: 'room',
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-03',
    roomCount: 1,
  },
} as SalesReservationRequestV1;
function batch(
  amount = '100',
  currencyCode = 'USD',
  adults = 2,
  childAges: { min: number; maxExclusive: number }[] = [],
): PackageTourHotelPurchaseBatchV1 {
  return {
    id: amount,
    rows: [
      {
        hotelId: 'hotel',
        currencyCode,
        brokerName: 'broker',
        roomRates: [
          {
            roomTypeId: 'room',
            occupancyRates: [
              {
                adults,
                childAges,
                currencyCode,
                amount,
                saleAmount: '999',
                board: 'BB',
                startsOn: '2026-10-01',
                endsOnExclusive: '2026-10-03',
              },
            ],
          },
        ],
      },
    ],
  } as unknown as PackageTourHotelPurchaseBatchV1;
}
describe('hotel reference purchase savings', () => {
  it('uses purchase not sale price and lowest complete matching quote', () => {
    expect(
      hotelReferencePurchase(
        [batch('110'), batch('100')],
        snapshot,
        [30, 31],
        'USD',
        'BB',
      ),
    ).toEqual({ amount: '200', batchId: '100', brokerName: 'broker' });
  });
  it('requires the same currency, board, exact guest composition and all nights', () => {
    expect(
      hotelReferencePurchase([batch()], snapshot, [30, 31], 'IRR', 'BB'),
    ).toBeNull();
    expect(
      hotelReferencePurchase([batch()], snapshot, [30, 31], 'USD', 'AI'),
    ).toBeNull();
    expect(
      hotelReferencePurchase([batch()], snapshot, [30, 7], 'USD', 'BB'),
    ).toBeNull();
    expect(
      hotelReferencePurchase(
        [batch('80', 'USD', 1, [{ min: 6, maxExclusive: 12 }])],
        snapshot,
        [30, 7],
        'USD',
        'BB',
      )?.amount,
    ).toBe('160');
    expect(
      hotelReferencePurchase(
        [batch()],
        {
          ...snapshot,
          hotelSelection: {
            ...snapshot.hotelSelection!,
            checkOutDate: '2026-10-04',
          },
        },
        [30, 31],
        'USD',
        'BB',
      ),
    ).toBeNull();
  });
  it('keeps exact fractional amounts and negative savings', async () => {
    const rates = { forTour: vi.fn().mockResolvedValue([batch('100.0001')]) };
    const service = new ReservationHotelSavingsService(
      {} as never,
      rates as never,
      { hotelGuestAges: vi.fn().mockResolvedValue([30, 31]) } as never,
      {} as never,
    );
    const quote = await service.quote(
      snapshot,
      'branch',
      'USD',
      { permissions: ['reservations.read'], branchIds: ['branch'] } as never,
      '220',
    );
    expect(quote.referenceAmount).toBe('200.0002');
    expect(quote.savingsAmount).toBe('-19.9998');
  });
  it('rejects cross-branch comparison before rate reads', async () => {
    const rates = { forTour: vi.fn() };
    const service = new ReservationHotelSavingsService(
      {} as never,
      rates as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.quote(snapshot, 'other', 'USD', {
        permissions: ['reservations.read'],
        branchIds: ['branch'],
      } as never),
    ).rejects.toThrow();
    expect(rates.forTour).not.toHaveBeenCalled();
  });
});

describe('saved hotel savings aggregation', () => {
  const actor = {
    permissions: ['reservations.read'],
    branchIds: ['branch'],
  } as never;
  const purchase = (
    amount: string | null,
    currencyCode = 'USD',
    key = 'hotel',
  ) => ({
    serviceClientKey: key,
    financeRevisions: [],
    passengerPrices:
      amount === null
        ? []
        : {
            hotelSavings: {
              version: 1,
              status: 'AVAILABLE',
              referenceAmount: '200',
              actualAmount: '180',
              savingsAmount: amount,
              currencyCode,
            },
          },
  });
  const row = (contractId: string, purchases: unknown[]) => ({
    contractId,
    status: 'PENDING',
    receivedAt: new Date('2026-10-10'),
    snapshot: {
      createdAt: '2026-10-01T00:00:00Z',
      hotelSelection: { checkInDate: '2026-10-20' },
    },
    workflowRevisions: [],
    servicePurchases: purchases,
  });
  it('counts only latest purchase/contract revisions, preserves negative totals, separates currencies and excludes rejected/cancelled purchases', async () => {
    const rows = [
      row('a', [purchase('20'), purchase('99')]),
      row('a', [purchase('1000')]),
      row('b', [purchase('-30')]),
      row('c', [purchase('8', 'IRR')]),
      row('d', [purchase(null)]),
      { ...row('e', [purchase('90')]), status: 'CANCELLED' },
      row('f', [
        { ...purchase('80'), financeRevisions: [{ status: 'REJECTED' }] },
      ]),
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const service = new ReservationHotelSavingsService(
      { client: { reservationIntake: { findMany } } } as never,
      {} as never,
      {
        hotelSavingsContracts: vi
          .fn()
          .mockResolvedValue(
            new Map(
              ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => [
                id,
                { createdAt: new Date('2026-10-01'), status: 'ACTIVE' },
              ]),
            ),
          ),
      } as never,
      {} as never,
    );
    expect(
      (
        await service.summary(
          { from: '2026-10-20', to: '2026-10-20', dateBasis: 'travelDate' },
          actor,
        )
      ).data,
    ).toEqual({
      comparedCount: 3,
      unavailableCount: 1,
      totals: [
        { currencyCode: 'USD', amount: '-10' },
        { currencyCode: 'IRR', amount: '8' },
      ],
    });
    expect(findMany.mock.calls[0]![0].where.branchId).toEqual({
      in: ['branch'],
    });
    expect(
      (
        await service.summary(
          { from: '2026-10-02', dateBasis: 'createdAt' },
          actor,
        )
      ).data.comparedCount,
    ).toBe(0);
    await expect(
      service.summary({ from: '2026-02-30' }, actor),
    ).rejects.toThrow();
  });
  it('does not read purchases without reservation permission', async () => {
    const findMany = vi.fn();
    const service = new ReservationHotelSavingsService(
      { client: { reservationIntake: { findMany } } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.summary({}, { permissions: [], branchIds: ['branch'] } as never),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
  });
});

it('honours explicit single/double rooms and refuses unknown extra-bed placement', () => {
  const rates = batch();
  const room = rates.rows[0]!.roomRates[0]!;
  room.occupancyRates = [
    ...room.occupancyRates!,
    { ...room.occupancyRates![0]!, adults: 1, amount: '70' },
    { ...room.occupancyRates![0]!, adults: 3, amount: '80' },
  ];
  const selected = {
    ...snapshot,
    hotelSelection: {
      ...snapshot.hotelSelection!,
      roomCount: 2,
      singleRoomCount: 0,
      doubleRoomCount: 2,
    },
  };
  expect(
    hotelReferencePurchase([rates], selected, [30, 31, 32, 33], 'USD', 'BB')
      ?.amount,
  ).toBe('400');
  expect(
    hotelReferencePurchase(
      [rates],
      {
        ...selected,
        hotelSelection: { ...selected.hotelSelection!, extraBedCount: 1 },
      },
      [30, 31, 32, 33],
      'USD',
      'BB',
    ),
  ).toBeNull();
});

describe('recorded hotel-only cost projection', () => {
  const actor = {
    permissions: ['reservations.read'],
    branchIds: ['branch'],
  } as never;
  function setup(purchases: unknown[] = []) {
    const findFirst = vi.fn().mockResolvedValue({
      branchId: 'branch',
      snapshot,
      servicePurchases: purchases,
      hotelPurchases: [],
    });
    const service = new ReservationHotelSavingsService(
      { client: { reservationIntake: { findFirst } } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, findFirst };
  }
  const purchase = (kind = 'HOTEL', key = 'hotel') => ({
    serviceKind: kind,
    serviceClientKey: key,
    amount: { toFixed: () => '180', toString: () => '180' },
    currencyCode: 'USD',
    financeRevisions: [],
    passengerPrices: {
      hotelSavings: {
        version: 1,
        status: 'AVAILABLE',
        referenceAmount: '200',
        actualAmount: '180',
        savingsAmount: '20',
        currencyCode: 'USD',
        reason: null,
        capturedAt: '2026-10-13',
        sourceBatchId: 'rate',
        sourceBrokerName: 'broker',
        checkIn: '2026-10-01',
        checkOut: '2026-10-03',
        flightCost: '999',
      },
    },
  });
  it('only returns latest non-rejected hotel costs and a bounded projection', async () => {
    const { service, findFirst } = setup([
      purchase('FLIGHT', 'flight'),
      purchase(),
      purchase(),
      {
        ...purchase('HOTEL', 'rejected'),
        financeRevisions: [{ status: 'REJECTED' }],
      },
      purchase('HOTEL', 'rejected'),
    ]);
    const result = await service.recorded('id', actor);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      referenceAmount: '200',
      actualAmount: '180',
      savingsAmount: '20',
    });
    expect(JSON.stringify(result)).not.toContain('flightCost');
    expect(JSON.stringify(result)).not.toContain('999');
    expect(findFirst.mock.calls[0]![0]).toMatchObject({
      where: { id: 'id', branchId: { in: ['branch'] } },
      include: { servicePurchases: { where: { serviceKind: 'HOTEL' } } },
    });
  });
  it('rejects missing permission before query and unavailable branch intake', async () => {
    const { service, findFirst } = setup();
    await expect(
      service.recorded('id', {
        permissions: [],
        branchIds: ['branch'],
      } as never),
    ).rejects.toThrow();
    expect(findFirst).not.toHaveBeenCalled();
    findFirst.mockResolvedValue(null);
    await expect(service.recorded('id', actor)).rejects.toThrow();
  });
  it('quotes current reference for old purchases but keeps final recorded amount', async () => {
    const { service } = setup([{ ...purchase(), passengerPrices: [] }]);
    const quote = vi.spyOn(service, 'quote').mockResolvedValue({
      status: 'AVAILABLE',
      actualAmount: '180',
      referenceAmount: '210',
    } as never);
    expect((await service.recorded('id', actor)).data[0]).toMatchObject({
      actualAmount: '180',
      referenceAmount: '210',
      reason: 'CURRENT_REFERENCE',
    });
    expect(quote).toHaveBeenCalledWith(snapshot, 'branch', 'USD', actor, '180');
  });
});
