import { expect, it } from 'vitest';
import type { MasterDataRecord } from '@nora/contracts';
import { emptySalesForm, salesPayload, salesHotelValid } from './sales-form';
import {
  withCompositeHotel,
  contractHotelChoices,
  selectedContractHotelKey,
  compositeHotelChoice,
  hotelsAtContractDestination,
} from './composite-hotel-selection';
import { restoreContractDraft } from './restore-contract-draft';

const record = {
  id: 'composite-1',
  name: 'Two city hotels',
  attributes: {
    memberHotelIds: 'h1,h2',
    memberHotels: JSON.stringify([
      { hotelId: 'h1', cityId: 'c1', hotelName: 'ONE, HOTEL' },
      { hotelId: 'h2', cityId: 'c2', hotelName: 'TWO HOTEL' },
    ]),
  },
} as unknown as MasterDataRecord;
it('limits primary hotel and composite choices to the selected destination city', () => {
  const items = [
    { id: 'first', attributes: { cityId: 'c1' } },
    { id: 'other', attributes: { cityId: 'c2' } },
    {
      id: 'composite',
      attributes: { cityId: 'c1', memberHotelIds: 'first,other' },
    },
  ] as unknown as MasterDataRecord[];
  expect(
    hotelsAtContractDestination(items, 'c1').map((hotel) => hotel.id),
  ).toEqual(['first', 'composite']);
  expect(
    hotelsAtContractDestination(items, 'c2').map((hotel) => hotel.id),
  ).toEqual(['other']);
  expect(hotelsAtContractDestination(items, '')).toEqual([]);
});
it('lists real hotels and composites together without ID collisions or stale English titles', () => {
  const hotel = {
    id: 'composite-1',
    name: 'Ordinary hotel',
    attributes: { englishName: 'Ordinary hotel' },
  } as unknown as MasterDataRecord;
  const choices = contractHotelChoices(
    [hotel],
    [
      {
        ...record,
        attributes: {
          ...record.attributes,
          englishName: 'Old composite title',
        },
      },
    ],
  );
  expect(choices.map((c) => c.id)).toEqual([
    'composite-1',
    'composite:composite-1',
  ]);
  expect(choices[0]).toBe(hotel);
  expect(choices[1]).toMatchObject({
    name: record.name,
    attributes: { englishName: '' },
  });
  expect(compositeHotelChoice('composite-1', [record])).toBeUndefined();
  expect(compositeHotelChoice('composite:composite-1', [record])).toBe(record);
});
it('shows the composite in the same picker after loading its ordered real hotels', () => {
  const state = withCompositeHotel(structuredClone(emptySalesForm), record);
  expect(selectedContractHotelKey(state, [record])).toBe(
    'composite:composite-1',
  );
  expect(
    selectedContractHotelKey(
      { ...state, hotel: { ...state.hotel, additionalStays: [] } },
      [record],
    ),
  ).toBe('h1');
  expect(selectedContractHotelKey(state, [])).toBe('h1');
  const reordered = {
    ...state,
    hotel: {
      ...state.hotel,
      hotelId: 'h2',
      additionalStays: [{ ...state.hotel.additionalStays![0]!, hotelId: 'h1' }],
    },
  };
  expect(selectedContractHotelKey(reordered, [record])).toBe('h2');
});
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
    rooms: state.hotel.rooms,
  });
  expect(salesHotelValid(state)).toBe(true);
  state.hotel.additionalStays![0]!.rooms![0]!.roomCategory = 'SINGLE';
  expect(salesPayload(state).hotelSelection?.additionalStays).toEqual(
    state.hotel.additionalStays,
  );
  state.hotel.occupancy = 2;
  state.hotel.additionalStays![0]!.rooms![0]!.childAges = [null];
  expect(salesHotelValid(state)).toBe(false);
  state.hotel.additionalStays![0]!.rooms![0]!.childAges = [5];
  expect(salesHotelValid(state)).toBe(true);
  state.hotel.additionalStays![0]!.checkInDate = '2099-01-02';
  expect(salesHotelValid(state)).toBe(false);
});
