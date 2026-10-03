import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  ReservationServicePurchaseService,
  hotelPassengerPurchase,
  purchasableReservationService,
  validateServicePurchase,
} from './reservation-service-purchase.service';

const valid = {
  version: 1 as const,
  expectedVersion: 0,
  serviceClientKey: 'hotel-1',
  supplierOrganizationId: '11111111-1111-4111-8111-111111111111',
  amount: '1250000',
  currencyCode: 'IRR',
};

describe('service purchase validation', () => {
  it('accepts a positive service purchase with broker and currency', () => {
    expect(() => validateServicePurchase(valid)).not.toThrow();
  });

  it('rejects zero amounts and malformed currencies', () => {
    expect(() => validateServicePurchase({ ...valid, amount: '0' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateServicePurchase({ ...valid, currencyCode: 'irr' }),
    ).toThrow(BadRequestException);
  });
  it('accepts fractional formula inputs and rejects mixed or invalid formulas', () => {
    expect(() =>
      validateServicePurchase({
        ...valid,
        pricingCalculation: { baseAmount: '0.0001', factor: '0.1' },
      }),
    ).not.toThrow();
    expect(() =>
      validateServicePurchase({
        ...valid,
        pricingCalculation: { baseAmount: '100', factor: '0' },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateServicePurchase({
        ...valid,
        pricingCalculation: { baseAmount: '100', factor: '2' },
        transferUnitAmount: '100',
      }),
    ).toThrow(BadRequestException);
  });
});

it('calculates and preserves a nightly hotel total for every assigned passenger', () => {
  expect(
    hotelPassengerPurchase(
      {
        passengerIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
        passengerAssignments: [
          {
            customerId: '11111111-1111-4111-8111-111111111111',
            displayNameSnapshot: 'مسافر اول',
            ageCategory: 'ADL',
            serviceClientKeys: ['hotel-1'],
          },
          {
            customerId: '22222222-2222-4222-8222-222222222222',
            displayNameSnapshot: 'مسافر دوم',
            ageCategory: 'CHD',
            serviceClientKeys: ['hotel-1'],
          },
        ],
        hotelSelection: {
          serviceClientKey: 'hotel-1',
          checkInDate: '2026-10-01',
          checkOutDate: '2026-10-04',
        },
      } as never,
      'hotel-1',
      [
        {
          customerId: '11111111-1111-4111-8111-111111111111',
          nightlyAmount: '100',
        },
        {
          customerId: '22222222-2222-4222-8222-222222222222',
          nightlyAmount: '50',
        },
      ],
    ),
  ).toMatchObject({
    amount: '450',
    passengerPrices: [
      { passengerName: 'مسافر اول', nights: 3, totalAmount: '300' },
      { passengerName: 'مسافر دوم', nights: 3, totalAmount: '150' },
    ],
  });
});

it('rejects a ticket purchase from the Reservations broker route', async () => {
  const database = {
    client: {
      reservationIntake: {
        findUnique: vi.fn().mockResolvedValue({
          branchId: 'branch-1',
          snapshot: {
            serviceSelections: [
              {
                clientKey: 'flight-1',
                kind: 'FLIGHT',
                titleSnapshot: 'Flight',
              },
            ],
          },
        }),
      },
    },
  };
  const directory = { brokerReference: vi.fn() };
  const service = new ReservationServicePurchaseService(
    database as never,
    directory as never,
  );
  await expect(
    service.record(
      '11111111-1111-4111-8111-111111111111',
      {
        ...valid,
        serviceClientKey: 'flight-1',
      },
      {
        userId: 'user-1',
        branchIds: ['branch-1'],
        permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
      } as never,
      'ticket-purchase',
    ),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(directory.brokerReference).not.toHaveBeenCalled();
});

it('accepts the hotel embedded in a legacy reservation snapshot', () => {
  expect(
    purchasableReservationService(
      {
        serviceSelections: [],
        hotelSelection: {
          serviceClientKey: 'hotel-legacy',
          hotelNameSnapshot: 'Royal Wings',
        },
      } as never,
      'hotel-legacy',
    ),
  ).toMatchObject({
    clientKey: 'hotel-legacy',
    kind: 'HOTEL',
    titleSnapshot: 'Royal Wings',
  });
});

it.each([false, true])(
  'records hotel and both transfer directions atomically (formula=%s)',
  async (formula) => {
    const create = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const database = {
      client: {
        reservationIntake: {
          findUnique: vi.fn().mockResolvedValue({
            branchId: 'branch-1',
            snapshot: {
              passengerIds: [],
              passengerAssignments: [
                {
                  customerId: '11111111-1111-4111-8111-111111111111',
                  displayNameSnapshot: 'مسافر اول',
                  ageCategory: 'ADL',
                  serviceClientKeys: ['hotel', 'outbound', 'return'],
                },
                {
                  customerId: '22222222-2222-4222-8222-222222222222',
                  displayNameSnapshot: 'مسافر دوم',
                  ageCategory: 'CHD',
                  serviceClientKeys: ['hotel', 'return'],
                },
              ],
              serviceSelections: [
                { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
                {
                  clientKey: 'outbound',
                  kind: 'TRANSFER',
                  titleSnapshot: 'Outbound',
                },
                {
                  clientKey: 'return',
                  kind: 'TRANSFER',
                  titleSnapshot: 'Return',
                },
              ],
              hotelSelection: {
                serviceClientKey: 'hotel',
                hotelNameSnapshot: 'Royal Wings',
                checkInDate: '2026-10-01',
                checkOutDate: '2026-10-04',
              },
            },
            workflowRevisions: [
              {
                state: {
                  sentSupplierFormSettings: {
                    text: {
                      checkIn: '2026-10-01',
                      checkOut: formula ? '2026-10-10' : '2026-10-04',
                    },
                  },
                },
              },
            ],
          }),
        },
        reservationServicePurchase: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn(async (run: (tx: unknown) => Promise<unknown>) =>
          run({
            $queryRaw: vi.fn().mockResolvedValue([]),
            reservationIntake: { updateMany },
            reservationServicePurchase: { create },
          }),
        ),
      },
    };
    const directory = {
      brokerReference: vi.fn().mockResolvedValue({
        id: valid.supplierOrganizationId,
        name: 'کارگزار',
      }),
      currencyReference: vi.fn().mockResolvedValue({ code: 'IRR' }),
    };
    const service = new ReservationServicePurchaseService(
      database as never,
      directory as never,
    );
    const purchases = [
      {
        serviceClientKey: 'hotel',
        coveredServiceClientKeys: ['hotel'],
        supplierOrganizationId: valid.supplierOrganizationId,
        amount: '450',
        currencyCode: 'IRR',
        pricingCalculation: { baseAmount: '100', factor: '1.5' },
      },
      {
        serviceClientKey: 'outbound',
        coveredServiceClientKeys: ['outbound', 'return'],
        supplierOrganizationId: valid.supplierOrganizationId,
        amount: '150',
        currencyCode: 'IRR',
        pricingCalculation: { baseAmount: '25', factor: '2' },
      },
    ];
    if (formula) {
      await expect(
        service.recordBatch(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          {
            version: 1,
            expectedVersion: 0,
            purchases: purchases.map((p) => ({ ...p, amount: '1' })),
          },
          {
            userId: 'user-1',
            branchIds: ['branch-1'],
            permissions: [
              'reservations.read',
              'reservations.hotel_purchase.write',
            ],
          } as never,
          'tampered',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    }
    const result = await service.recordBatch(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      {
        version: 1,
        expectedVersion: 0,
        purchases: formula
          ? purchases
          : [
              {
                serviceClientKey: 'hotel',
                coveredServiceClientKeys: ['hotel'],
                supplierOrganizationId: valid.supplierOrganizationId,
                amount: '450',
                currencyCode: 'IRR',
                passengerPrices: [
                  {
                    customerId: '11111111-1111-4111-8111-111111111111',
                    nightlyAmount: '100',
                  },
                  {
                    customerId: '22222222-2222-4222-8222-222222222222',
                    nightlyAmount: '50',
                  },
                ],
              },
              {
                serviceClientKey: 'outbound',
                coveredServiceClientKeys: ['outbound', 'return'],
                supplierOrganizationId: valid.supplierOrganizationId,
                amount: '80',
                currencyCode: 'IRR',
                transferUnitAmount: '40',
              },
            ],
      },
      {
        userId: 'user-1',
        branchIds: ['branch-1'],
        permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
      } as never,
      'batch-test',
    );
    expect(result.data.batchId).toMatch(/^[0-9a-f-]{36}$/);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { purchaseVersion: { increment: 2 } } }),
    );
    expect(create).toHaveBeenCalledTimes(2);
    const hotel = create.mock.calls[0]![0].data;
    const transfer = create.mock.calls[1]![0].data;
    expect(hotel.batchId).toBe(transfer.batchId);
    expect(hotel.serviceTitleSnapshot).toBe('Royal Wings');
    expect(transfer.serviceTitleSnapshot).toBe('ترانسفر رفت‌وبرگشت');
    expect(transfer.amount).toBe(formula ? '150' : '80');
    if (formula) {
      expect(hotel.passengerPrices).toEqual({
        calculation: {
          baseAmount: '100',
          factor: '1.5',
          nights: 3,
          totalAmount: '450',
        },
      });
      expect(transfer.passengerPrices).toEqual({
        calculation: {
          baseAmount: '25',
          factor: '2',
          nights: 3,
          totalAmount: '150',
        },
      });
    } else expect(transfer.passengerPrices).toHaveLength(2);
  },
);
