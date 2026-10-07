import { describe, it, expect } from 'vitest';
import type { HotelRoomRateV1 } from '@nora/contracts';
import {
  emptySalesForm,
  salesHotelOccupancyQuote,
  hotelOccupancySaleDefaults,
  type SalesFormState,
} from './sales-form';
const room: HotelRoomRateV1 = {
  roomTypeId: 'standard',
  roomTypeName: 'Standard',
  factor: '1',
  maxAdults: 3,
  maxChildren: 2,
  maxChildren2To6: 2,
  maxChildren6To12: 0,
  maxInfants: 0,
  occupancyRates: [
    {
      adults: 2,
      childAges: [{ min: 3, maxExclusive: 7 }],
      startsOn: '2026-10-01',
      endsOnExclusive: '2026-11-01',
      amount: '120.50',
      currencyCode: 'EUR',
      composition: '2 AD + 1 CHD',
      board: 'BB',
    },
  ],
};
const draft = (): SalesFormState => ({
  ...emptySalesForm,
  serviceKinds: ['HOTEL'],
  passengerComposition: { adults: 2, children: 1, infants: 0 },
  childAges: [6],
  hotel: {
    ...emptySalesForm.hotel,
    roomTypeId: 'standard',
    roomCount: 1,
    checkIn: '2026-10-05',
    checkOut: '2026-10-07',
  },
});
describe('new sales hotel occupancy pricing', () => {
  it.each([12, 17])(
    'prices child age %i from draft and actual birthday using the matching hotel band',
    (age) => {
      const teenRoom: HotelRoomRateV1 = {
        ...room,
        occupancyRates: [
          {
            ...room.occupancyRates![0]!,
            childAges: [{ min: 12, maxExclusive: 18 }],
          },
        ],
      };
      const s = { ...draft(), childAges: [age] };
      expect(salesHotelOccupancyQuote(s, teenRoom)?.amount).toBe('241');
      s.hotel.guestCustomerIds = ['a', 'b', 'c'];
      s.passengers = [
        { customerId: 'a', displayName: 'A', birthDate: '1990-01-01' },
        { customerId: 'b', displayName: 'B', birthDate: '1991-01-01' },
        { customerId: 'c', displayName: 'C', birthDate: `${2026 - age}-10-05` },
      ];
      expect(salesHotelOccupancyQuote(s, teenRoom)?.amount).toBe('241');
      expect(salesHotelOccupancyQuote(s, room)).toBeNull();
      s.passengers[2]!.birthDate = '2008-10-05';
      expect(salesHotelOccupancyQuote(s, teenRoom)).toBeNull();
      expect(
        salesHotelOccupancyQuote({ ...draft(), childAges: [18] }, teenRoom),
      ).toBeNull();
    },
  );
  it('shows eligible rooms and defaults total nightly quote rather than per-person factors', () => {
    expect(salesHotelOccupancyQuote(draft(), room)?.amount).toBe('241');
    expect(
      hotelOccupancySaleDefaults(draft(), room).servicePricing?.hotel?.[0]
        ?.daySale,
    ).toEqual({ basis: 'TOTAL', amount: '241' });
  });
  it('rejects missing age and seventh birthday', () => {
    expect(
      salesHotelOccupancyQuote({ ...draft(), childAges: [null] }, room),
    ).toBeNull();
    expect(
      salesHotelOccupancyQuote({ ...draft(), childAges: [7] }, room),
    ).toBeNull();
  });
  it('reprices dates while preserving a separately negotiated amount', () => {
    const initial = hotelOccupancySaleDefaults(draft(), room);
    const next = {
      ...initial,
      hotel: { ...initial.hotel, checkOut: '2026-10-08' },
    };
    expect(
      hotelOccupancySaleDefaults(next, room).servicePricing?.hotel?.[0]?.agreed
        .amount,
    ).toBe('361.5');
    next.servicePricing = {
      hotel: [
        {
          ...initial.servicePricing!.hotel![0]!,
          agreed: { basis: 'TOTAL', amount: '200' },
        },
      ],
    };
    expect(
      hotelOccupancySaleDefaults(next, room).servicePricing?.hotel?.[0],
    ).toMatchObject({
      daySale: { amount: '361.5' },
      agreed: { amount: '200' },
    });
  });
  it('uses actual selected guest birthdays instead of the draft age', () => {
    const s = draft();
    s.hotel.guestCustomerIds = ['a', 'b', 'c'];
    s.passengers = [
      { customerId: 'a', displayName: 'A', birthDate: '1990-01-01' },
      { customerId: 'b', displayName: 'B', birthDate: '1991-01-01' },
      { customerId: 'c', displayName: 'C', birthDate: '2019-10-05' },
    ];
    expect(salesHotelOccupancyQuote(s, room)).toBeNull();
  });
});
