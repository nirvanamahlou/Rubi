import { expect, it } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { emptySalesForm, salesPayload, salesHotelValid } from './sales-form';
import { withCompositeHotel } from './composite-hotel-selection';
import { restoreContractDraft } from './restore-contract-draft';

const record = {
  attributes: {
    memberHotels: JSON.stringify([
      { hotelId: 'h1', cityId: 'c1', hotelName: 'ONE, HOTEL' },
      { hotelId: 'h2', cityId: 'c2', hotelName: 'TWO HOTEL' },
    ]),
  },
} as unknown as MasterDataRecord;
it('loads each real hotel/city, clears old dates/rooms, and never clones charges', () => {
  const state = structuredClone(emptySalesForm);
  state.hotel.checkIn = '2099-01-01';
  state.hotel.checkOut = '2099-01-09';
  const next = withCompositeHotel(state, record);
  expect(next.hotel).toMatchObject({
    hotelId: 'h1',
    cityId: 'c1',
    name: 'ONE, HOTEL',
    checkIn: '',
    checkOut: '',
    rooms: [],
    additionalStays: [
      { hotelId: 'h2', cityId: 'c2', checkInDate: '', checkOutDate: '' },
    ],
  });
  expect(next.priceComponents).toEqual(state.priceComponents);
  expect(next.servicePricing).toEqual(state.servicePricing);
  expect(restoreContractDraft(next).hotel.additionalStays).toEqual(
    next.hotel.additionalStays,
  );
});
it('requires independent chronological dates and preserves the itinerary in payload', () => {
  const state = withCompositeHotel(structuredClone(emptySalesForm), record);
  state.serviceKinds = ['HOTEL'];
  Object.assign(state.hotel, {
    checkIn: '2099-01-01',
    checkOut: '2099-01-03',
    roomTypeId: 'r',
    roomCount: 1,
    singleRoomCount: 0,
    doubleRoomCount: 1,
    extraBedCount: 0,
    occupancy: 1,
  });
  state.hotel.rooms = [
    {
      ordinal: 1,
      roomTypeId: '10000000-0000-4000-8000-000000000011',
      roomTypeNameSnapshot: 'Double',
      adults: 1,
      childAges: [],
    },
  ];
  expect(salesHotelValid(state)).toBe(false);
  Object.assign(state.hotel.additionalStays![0]!, {
    checkInDate: '2099-01-03',
    checkOutDate: '2099-01-06',
  });
  expect(salesHotelValid(state)).toBe(true);
  expect(salesPayload(state).hotelSelection?.additionalStays).toEqual(
    state.hotel.additionalStays,
  );
  state.hotel.additionalStays![0]!.checkInDate = '2099-01-02';
  expect(salesHotelValid(state)).toBe(false);
});
