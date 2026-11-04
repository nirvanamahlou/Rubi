import { expect, it } from 'vitest';
import type { ReservationIntakeV1 } from '@nora/contracts';
import {
  reservationPurchaseRegistered,
  reservationPurchasesComplete,
} from './reservation-purchase-completion';
const context = (
  keys: string[],
  services: object[] = [{ clientKey: 'hotel', kind: 'HOTEL' }],
) =>
  ({
    snapshot: { serviceSelections: services, selectedTicketOfferIds: [] },
    servicePurchases: keys.map((key) => ({
      serviceClientKey: key,
      amount: '0',
    })),
  }) as unknown as ReservationIntakeV1;
it('marks saved zero purchases registered without any supplier form, even with other purchases outstanding', () => {
  const request = context(
    ['hotel'],
    [
      { clientKey: 'hotel', kind: 'HOTEL' },
      { clientKey: 'insurance', kind: 'INSURANCE' },
    ],
  );
  expect(reservationPurchaseRegistered(request)).toBe(true);
  expect(reservationPurchasesComplete(request)).toBe(false);
  expect(
    reservationPurchaseRegistered({
      hotelPurchases: [{ amount: '0' }] as never,
    }),
  ).toBe(true);
});
it('does not treat supplier-form quotes as purchases and excludes cancellations', () => {
  expect(reservationPurchaseRegistered({})).toBe(false);
  expect(
    reservationPurchaseRegistered({
      workflow: {
        supplierStatus: 'SENT_TO_SUPPLIER',
        supplierFormSettings: { proposedPurchasePrice: { amount: '100' } },
      },
    }),
  ).toBe(false);
  expect(
    reservationPurchaseRegistered({
      ...context(['hotel']),
      workflow: { supplierStatus: 'CANCELLED' },
    }),
  ).toBe(false);
});
it('requires every registered service, including explicit zero purchases; quotes are insufficient', () => {
  expect(reservationPurchasesComplete(context([]))).toBe(false);
  expect(reservationPurchasesComplete(context(['hotel']))).toBe(true);
  expect(
    reservationPurchasesComplete(
      context(
        ['hotel'],
        [
          { clientKey: 'hotel', kind: 'HOTEL' },
          { clientKey: 'insurance', kind: 'INSURANCE' },
        ],
      ),
    ),
  ).toBe(false);
  expect(reservationPurchasesComplete(context([], []))).toBe(false);
});
it('requires each combined hotel and its transfer legs, accepting shared coverage', () => {
  const request = context(['hotel']);
  request.snapshot.hotelSelection = {
    serviceClientKey: 'hotel',
    hotelId: 'first',
    additionalStays: [{ hotelId: 'second' }],
  } as never;
  request.snapshot.serviceSelections = [
    ...request.snapshot.serviceSelections,
    {
      clientKey: 'transfer-out',
      kind: 'TRANSFER',
    } as never,
  ];
  expect(reservationPurchasesComplete(request)).toBe(false);
  request.servicePurchases = [
    ...request.servicePurchases!,
    {
      serviceClientKey: 'hotel-stay:2:second',
      coveredServiceClientKeys: ['hotel-stay:2:second'],
    },
    {
      serviceClientKey: 'transfer-out',
      coveredServiceClientKeys: [
        'transfer-out',
        'hotel-transfer:2:second',
        'hotel-transfer:2:second:return',
      ],
    },
  ] as unknown as NonNullable<ReservationIntakeV1['servicePurchases']>;
  expect(reservationPurchasesComplete(request)).toBe(true);
  request.servicePurchases = request.servicePurchases!.slice(0, 2);
  expect(reservationPurchasesComplete(request)).toBe(false);
});
it('does not make company capacity a contract purchase and fails closed for unknown flights', () => {
  for (const supply of ['COMPANY', 'API'])
    expect(
      reservationPurchasesComplete(
        context(
          ['hotel'],
          [
            { clientKey: 'hotel', kind: 'HOTEL' },
            {
              clientKey: 'flight',
              kind: 'FLIGHT',
              metadata: { purchaseSupplyType: supply },
            },
          ],
        ),
      ),
    ).toBe(true);
  for (const supply of ['UNKNOWN', 'FLOATING'])
    expect(
      reservationPurchasesComplete(
        context(
          ['hotel'],
          [
            { clientKey: 'hotel', kind: 'HOTEL' },
            {
              clientKey: 'flight',
              kind: 'FLIGHT',
              metadata: { purchaseSupplyType: supply },
            },
          ],
        ),
      ),
    ).toBe(false);
  expect(
    reservationPurchasesComplete(
      context(
        ['flight'],
        [
          {
            clientKey: 'flight',
            kind: 'FLIGHT',
            metadata: { contractFlightVersion: 1 },
          },
        ],
      ),
    ),
  ).toBe(true);
});
it('uses the current execution hotel set and never covers a second hotel with a legacy total', () => {
  const request = context([]);
  request.purchaseSnapshot = {
    ...request.snapshot,
    hotelSelection: {
      serviceClientKey: 'hotel',
      hotelId: 'first',
      additionalStays: [{ hotelId: 'second' }],
    },
  } as never;
  request.hotelPurchases = [{ amount: '100' }] as never;
  expect(reservationPurchasesComplete(request)).toBe(false);
});
