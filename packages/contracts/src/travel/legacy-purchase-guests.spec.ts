import { expect, it } from 'vitest';
import type { SalesReservationRequestV1 } from '../sales';
import { legacyPurchaseGuests } from './legacy-purchase-guests';

const snapshot = () =>
  ({
    passengerIds: [],
    serviceSelections: [
      {
        clientKey: 'hotel',
        kind: 'HOTEL',
        metadata: {
          legacyServicePartiesV2: JSON.stringify({
            hotel: { adults: 2, children: 1, infants: 0 },
            transfer: { adults: 1, children: 0, infants: 0 },
          }),
        },
      },
      { clientKey: 'transfer', kind: 'TRANSFER' },
    ],
  }) as unknown as SalesReservationRequestV1;

it('derives only each service count as ordinals, never customer identities', () => {
  expect(legacyPurchaseGuests(snapshot(), 'hotel')).toEqual([
    { guestIndex: 0, ageCategory: 'ADT' },
    { guestIndex: 1, ageCategory: 'ADT' },
    { guestIndex: 2, ageCategory: 'CHD' },
  ]);
  expect(legacyPurchaseGuests(snapshot(), 'transfer')).toEqual([
    { guestIndex: 0, ageCategory: 'ADT' },
  ]);
  expect(legacyPurchaseGuests(snapshot(), 'foreign')).toEqual([]);
});
it('does not supplement an actual passenger list or fabricate counts for unmarked history', () => {
  expect(
    legacyPurchaseGuests({ ...snapshot(), passengerIds: ['real'] }, 'hotel'),
  ).toEqual([]);
  expect(
    legacyPurchaseGuests(
      {
        ...snapshot(),
        serviceSelections: [
          { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
        ],
      },
      'hotel',
    ),
  ).toEqual([]);
});
