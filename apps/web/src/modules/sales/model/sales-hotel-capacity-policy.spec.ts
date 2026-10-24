import { salesRoomPartyError } from './sales-room-prices';
import { expect, it } from 'vitest';
import { emptySalesForm, salesHotelCapacityError } from './sales-form';
it('temporarily permits unmatched guest/room combinations without inventing a rate', () => {
  const state = {
    ...emptySalesForm,
    serviceKinds: ['HOTEL'] as typeof emptySalesForm.serviceKinds,
    passengers: [
      {
        customerId: 'synthetic',
        displayName: 'Synthetic Child',
        birthDate: '2020-01-01',
      },
    ],
    hotel: {
      ...emptySalesForm.hotel,
      checkIn: '2026-10-24',
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'room',
          roomTypeNameSnapshot: 'Room',
          adults: 2,
          childAges: [],
        },
      ],
    },
  };
  expect(salesHotelCapacityError(state, [])).toBeNull();
  expect(
    salesRoomPartyError({
      ...state,
      serviceKinds: ['FLIGHT', 'HOTEL'],
      passengerComposition: { adults: 5, children: 2, infants: 1 },
    }),
  ).toBeNull();
});
