import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import {
  type AuthenticatedActor,
  reservationHotelStays,
  reservationHotelTransferKeys,
  reservationHotelTransferLegKeys,
  type ReservationPurchaseBatchInputV1,
} from '@nora/contracts';
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';
import { contractProfit } from '../sales/sales-profit';
const snapshot = {
  passengerIds: [],
  serviceSelections: [
    { clientKey: 'h', kind: 'HOTEL', titleSnapshot: 'FIRST' },
    { clientKey: 'out', kind: 'TRANSFER', titleSnapshot: 'TRANSFER' },
  ],
  hotelSelection: {
    serviceClientKey: 'h',
    hotelId: 'first',
    hotelNameSnapshot: 'FIRST',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-04',
    rooms: [
      { ordinal: 1, adults: 2, childAges: [], roomTypeNameSnapshot: 'DBL' },
    ],
    additionalStays: [
      {
        hotelId: 'second',
        hotelNameSnapshot: 'SECOND',
        checkInDate: '2026-11-04',
        checkOutDate: '2026-11-09',
        rooms: [1, 2, 3].map((ordinal) => ({
          ordinal,
          adults: 1,
          childAges: [],
          roomTypeNameSnapshot: 'SGL',
        })),
      },
    ],
  },
};
const stays = reservationHotelStays(snapshot as never),
  key = stays[1]!.key,
  transferKey = reservationHotelTransferKeys(snapshot as never, key)[0]!;
const roomPrices = [
  { roomOrdinal: 1, baseAmount: '120', factor: '2.5' },
  { roomOrdinal: 2, baseAmount: '80', factor: '1.5' },
  { roomOrdinal: 3, baseAmount: '0', factor: '1' },
];
const input: ReservationPurchaseBatchInputV1 = {
  version: 1,
  expectedVersion: 0,
  hotelStayKey: key,
  supplierFormVersion: 0,
  hotelTransferCounts: { outbound: 0, returning: 0 },
  purchases: [
    {
      serviceClientKey: key,
      coveredServiceClientKeys: [key],
      supplierOrganizationId: '11111111-1111-4111-8111-111111111111',
      amount: '2100',
      currencyCode: 'EUR',
      roomPrices,
    },
    {
      serviceClientKey: transferKey,
      coveredServiceClientKeys: [transferKey],
      supplierOrganizationId: '22222222-2222-4222-8222-222222222222',
      amount: '0',
      currencyCode: 'IRR',
      pricingCalculation: {
        baseAmount: '0',
        factor: '1',
        chargeablePassengerCount: 0,
      },
    },
  ],
};
const actor = {
  userId: 'payer',
  branchIds: ['branch'],
  permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
} as unknown as AuthenticatedActor;
function setup() {
  const create = vi.fn(async ({ data }) => ({
    ...data,
    id: 'purchase-' + data.version,
    createdAt: new Date('2026-10-31T00:00:00Z'),
  }));
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const tx = {
    reservationWorkflowRevision: { findFirst: vi.fn(async () => null) },
    $queryRaw: vi.fn(),
    reservationIntake: { updateMany },
    reservationServicePurchase: { create },
  };
  const database = {
    client: {
      reservationWorkflowRevision: { findFirst: vi.fn(async () => null) },
      reservationIntake: {
        findUnique: vi.fn(async () => ({ snapshot, branchId: 'branch' })),
      },
      reservationServicePurchase: { findUnique: vi.fn(async () => null) },
      $transaction: async (work: (tx: unknown) => unknown) => work(tx),
    },
  };
  const service = new ReservationServicePurchaseService(
    database as never,
    {
      brokerReference: vi.fn(async (id: string) => ({
        id,
        name: 'TEST SUPPLIER',
        source: 'BROKER',
      })),
      currencyReference: vi.fn(async () => ({})),
    } as never,
  );
  return { service, create, updateMany, tx, database };
}
it('records one atomic hotel purchase from all room formulas and a separate zero transfer, with canonical stay nights', async () => {
  const { service, create, updateMany } = setup();
  await service.recordBatch(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    input,
    actor,
    'hotel-batch',
  );
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0]![0].data).toMatchObject({
    serviceClientKey: key,
    serviceTitleSnapshot: 'SECOND',
    amount: '2100',
    currencyCode: 'EUR',
    supplierBrokerId: input.purchases[0]!.supplierOrganizationId,
    passengerPrices: { roomPrices, hotelStayKey: key },
  });
  expect(create.mock.calls[1]![0].data).toMatchObject({
    amount: '0',
    currencyCode: 'IRR',
    passengerPrices: { hotelTransferCounts: { outbound: 0, returning: 0 } },
  });
  expect(updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { purchaseVersion: { increment: 2 } } }),
  );
});
it('rejects forged stay, room totals, duplicate room entries, cross-branch and over-capacity transfers before writing', async () => {
  for (const body of [
    { ...input, hotelStayKey: 'foreign' },
    {
      ...input,
      purchases: [{ ...input.purchases[0]!, amount: '1' }, input.purchases[1]!],
    },
    {
      ...input,
      purchases: [
        {
          ...input.purchases[0]!,
          roomPrices: [roomPrices[0]!, roomPrices[0]!, roomPrices[2]!],
        },
        input.purchases[1]!,
      ],
    },
    { ...input, hotelTransferCounts: { outbound: 4, returning: 0 } },
  ]) {
    const { service, create } = setup();
    await expect(
      service.recordBatch(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        body,
        actor,
        'invalid',
      ),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  }
  const { service, create } = setup();
  await expect(
    service.recordBatch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      input,
      { ...actor, branchIds: [] } as never,
      'invalid',
    ),
  ).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});
it('sums both actual hotel purchases per currency, includes transfer once and suppresses old hotel fallback', () => {
  const purchases = [
    {
      id: 'one',
      serviceClientKey: 'h',
      amount: '900',
      currencyCode: 'EUR',
      roomPrices: [roomPrices[0]!],
    },
    { id: 'trf1', serviceClientKey: 'out', amount: '0', currencyCode: 'IRR' },
    {
      id: 'two',
      serviceClientKey: key,
      amount: '2100',
      currencyCode: 'EUR',
      roomPrices,
    },
    {
      id: 'trf2',
      serviceClientKey: transferKey,
      amount: '0',
      currencyCode: 'IRR',
    },
    { id: 'old', serviceClientKey: 'h', amount: '9999', currencyCode: 'EUR' },
  ];
  const contract = {
    servicesDetail: snapshot.serviceSelections,
    hotelSelection: snapshot.hotelSelection,
    ticketSelections: [],
    passengersDetail: [],
    priceComponents: [{ type: 'BASE', amount: '10000', currencyCode: 'EUR' }],
  };
  const result = contractProfit(
    contract as never,
    {
      snapshot,
      servicePurchases: purchases,
      hotelPurchases: [{ id: 'legacy', amount: '9999', currencyCode: 'EUR' }],
    } as never,
    [],
  );
  expect(result.complete).toBe(true);
  expect(result.costs).toHaveLength(4);
  expect(
    result.totals.find((total) => total.currencyCode === 'EUR'),
  ).toMatchObject({ purchaseAmount: '3000' });
});

it.each(['0', '10'])(
  'prices the hotel transfer by count alone at unit rate %s, independently of rooms and nights',
  async (rate) => {
    const { service, create } = setup();
    const body = {
      ...input,
      hotelTransferCounts: { outbound: 3, returning: 2 },
      purchases: [
        input.purchases[0]!,
        {
          ...input.purchases[1]!,
          amount: rate === '0' ? '0' : '50',
          pricingCalculation: {
            baseAmount: rate,
            factor: '5',
            chargeablePassengerCount: 5,
          },
        },
      ],
    };
    await service.recordBatch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      body,
      actor,
      'transfer-rate',
    );
    expect(create.mock.calls[1]![0].data).toMatchObject({
      amount: rate === '0' ? '0' : '50',
      passengerPrices: {
        calculation: { nights: 1, chargeablePassengerCount: 5 },
      },
    });
  },
);
it('rejects a concurrently changed supplier form inside the locked purchase transaction', async () => {
  const { service, create, tx } = setup();
  tx.reservationWorkflowRevision.findFirst.mockResolvedValue({
    version: 1,
  } as never);
  await expect(
    service.recordBatch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      input,
      actor,
      'stale-form',
    ),
  ).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});

it('atomically prices independent outbound and return brokers by their own counts without room or night multiplication', async () => {
  const { service, create, updateMany } = setup();
  const keys = reservationHotelTransferLegKeys(snapshot as never, key);
  const body = {
    ...input,
    hotelTransferCounts: { outbound: 2, returning: 1 },
    purchases: [
      input.purchases[0]!,
      ...keys.map((serviceClientKey, index) => ({
        serviceClientKey,
        coveredServiceClientKeys: [serviceClientKey],
        supplierOrganizationId: index
          ? '33333333-3333-4333-8333-333333333333'
          : '22222222-2222-4222-8222-222222222222',
        currencyCode: 'IRR',
        amount: index ? '20.5' : '20.25',
        pricingCalculation: {
          baseAmount: index ? '20.5' : '10.125',
          factor: index ? '1' : '2',
          chargeablePassengerCount: index ? 1 : 2,
        },
      })),
    ],
  };
  await service.recordBatch(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    body,
    actor,
    'split-hotel-batch',
  );
  expect(create).toHaveBeenCalledTimes(3);
  expect(create.mock.calls[1]![0].data).toMatchObject({
    amount: '20.25',
    supplierBrokerId: '22222222-2222-4222-8222-222222222222',
    passengerPrices: { hotelTransferCounts: { outbound: 2, returning: 0 } },
  });
  expect(create.mock.calls[2]![0].data).toMatchObject({
    amount: '20.5',
    supplierBrokerId: '33333333-3333-4333-8333-333333333333',
    passengerPrices: { hotelTransferCounts: { outbound: 0, returning: 1 } },
  });
  expect(updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: { purchaseVersion: { increment: 3 } } }),
  );
  const invalid = setup();
  await expect(
    invalid.service.recordBatch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        ...body,
        purchases: body.purchases.map((row, i) =>
          i === 2
            ? {
                ...row,
                pricingCalculation: {
                  baseAmount: '20.5',
                  factor: '2',
                  chargeablePassengerCount: 2,
                },
                amount: '41',
              }
            : row,
        ),
      },
      actor,
      'wrong-leg-count',
    ),
  ).rejects.toThrow();
  expect(invalid.create).not.toHaveBeenCalled();
});
