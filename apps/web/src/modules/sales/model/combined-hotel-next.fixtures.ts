import { emptySalesForm, type SalesFormState } from './sales-form';

export function combinedHotelDraft(): SalesFormState {
  return {
    ...structuredClone(emptySalesForm),
    serviceKinds: ['HOTEL'],
    customerId: 'guest',
    originId: '10000000-0000-4000-8000-000000000003',
    originCountryId: 'country',
    destinationCountryId: 'country',
    destinationId: '10000000-0000-4000-8000-000000000004',
    passengerComposition: { adults: 1, children: 0, infants: 0 },
    passengers: [
      {
        customerId: 'guest',
        displayName: 'Synthetic Guest',
        birthDate: '2000-01-01',
      },
    ],
    hotel: {
      ...emptySalesForm.hotel,
      guestCustomerIds: ['guest'],
      hotelId: 'one',
      name: 'First',
      cityId: 'city',
      checkIn: '2099-01-01',
      checkOut: '2099-01-09',
      checkInManual: true,
      checkOutManual: false,
      roomTypeId: '10000000-0000-4000-8000-000000000001',
      roomCount: 1,
      singleRoomCount: 1,
      doubleRoomCount: 0,
      extraBedCount: 0,
      occupancy: 1,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '10000000-0000-4000-8000-000000000001',
          roomTypeNameSnapshot: 'Single',
          adults: 1,
          childAges: [],
        },
      ],
      multiHotel: true,
      additionalStays: [
        {
          hotelId: 'two',
          hotelNameSnapshot: 'Second',
          cityId: 'other-city',
          checkInDate: '2099-01-04',
          checkOutDate: '2099-01-09',
          rooms: [
            {
              ordinal: 1,
              roomTypeId: '10000000-0000-4000-8000-000000000002',
              roomTypeNameSnapshot: 'Single',
              adults: 1,
              childAges: [],
            },
          ],
        },
      ],
    },
  };
}
