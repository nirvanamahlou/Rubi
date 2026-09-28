import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  ReservationServicePurchaseService,
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
