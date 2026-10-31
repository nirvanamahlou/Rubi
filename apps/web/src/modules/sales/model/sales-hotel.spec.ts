import type * as Contracts from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { HotelRoomRateV1, TicketOfferV1 } from '@nora/contracts';
import {
  emptySalesForm,
  salesDetailSteps,
  salesHotelDate,
  salesHotelCapacityError,
  salesHotelRoomTypes,
  salesHotelValid,
  salesPayload,
  withSalesHotelDates,
  type SalesFormState,
} from './sales-form';

const offer = (departureAt: string): TicketOfferV1 => ({
  id: 'synthetic-offer',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt,
  arrivalAt: departureAt,
  carrierName: 'Test',
  serviceNumber: 'TEST',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 20,
  status: 'ACTIVE',
});
const base: SalesFormState = {
  ...emptySalesForm,
  serviceKinds: ['FLIGHT', 'HOTEL'],
  tripType: 'ROUND_TRIP',
};
const selected = (): SalesFormState =>
  withSalesHotelDates(base, {
    ...base,
    outboundOffer: offer('2026-09-10T07:00:00Z'),
    returnOffer: offer('2026-09-20T07:00:00Z'),
  });

describe('combined flight and hotel details', () => {
  it('allows linked rooms without tariffs before pricing and preserves independent foreign prices', () => {
    const state: SalesFormState = {
      ...selected(),
      passengerComposition: { adults: 2, children: 1, infants: 0 },
      hotel: {
        ...selected().hotel,
        hotelId: 'hotel',
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomCount: 2,
        rooms: [
          {
            ordinal: 1,
            roomTypeId: '11111111-1111-4111-8111-111111111111',
            roomTypeNameSnapshot: 'Double',
            adults: 1,
            childAges: [5],
          },
          {
            ordinal: 2,
            roomTypeId: '22222222-2222-4222-8222-222222222222',
            roomTypeNameSnapshot: 'Single',
            adults: 1,
            childAges: [],
          },
        ],
      },
    };
    expect(salesHotelValid(state)).toBe(true);
    expect(salesHotelCapacityError(state, [])).toBeNull();
    state.hotel.rooms![0]!.agreedPrice = {
      amount: '120.50',
      currencyCode: 'EUR',
    };
    state.hotel.rooms![1]!.agreedPrice = { amount: '90', currencyCode: 'USD' };
    expect(salesHotelCapacityError(state, [])).toBeNull();
    expect(
      salesPayload(state).hotelSelection?.rooms?.map((r) => r.agreedPrice),
    ).toEqual([
      { amount: '120.50', currencyCode: 'EUR' },
      { amount: '90', currencyCode: 'USD' },
    ]);
    expect(
      salesHotelCapacityError(state, [
        {
          roomTypeId: state.hotel.rooms![1]!.roomTypeId,
          roomTypeName: 'Single',
          factor: '1',
          maxAdults: 0,
          maxChildren: 0,
        },
      ]),
    ).toBe('ظرفیت یا نرخ یکی از اتاق‌ها با ترکیب مهمانان هماهنگ نیست.');
    state.hotel.rooms![0]!.childAges = [null];
    expect(salesHotelCapacityError(state, [])).toBe(
      'سن کودکان هر اتاق را تکمیل کنید.',
    );
  });
  it('shows room types linked to the selected hotel before a dated rate exists', () => {
    const record = (
      id: string,
      resource: 'hotels' | 'room-types',
      roomTypeIds = '',
    ) => ({
      id,
      resource,
      code: id,
      name: id,
      status: 'active' as const,
      attributes: roomTypeIds ? { roomTypeIds } : {},
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const rooms = [
      record('single', 'room-types'),
      record('double', 'room-types'),
      record('suite', 'room-types'),
    ];

    expect(
      salesHotelRoomTypes(
        'hotel',
        [record('hotel', 'hotels', ' single, double ')],
        rooms,
      ).map((room) => room.id),
    ).toEqual(['single', 'double']);
    expect(
      salesHotelRoomTypes('hotel', [record('hotel', 'hotels')], rooms, [
        'suite',
      ]).map((room) => room.id),
    ).toEqual(['suite']);
  });

  it('combines hotel into the flight step regardless of service selection order', () => {
    expect(salesDetailSteps(base)).toEqual(['FLIGHT']);
    expect(
      salesDetailSteps({ ...base, serviceKinds: ['HOTEL', 'FLIGHT', 'VISA'] }),
    ).toEqual(['FLIGHT', 'VISA']);
    expect(
      salesDetailSteps({ ...base, serviceKinds: ['HOTEL', 'VISA'] }),
    ).toEqual(['HOTEL', 'VISA']);
  });
  it('defaults to the outbound day and day before return', () => {
    expect(selected().hotel).toMatchObject({
      checkIn: '2026-09-10',
      checkOut: '2026-09-19',
    });
  });
  it('uses the displayed Tehran day and handles month/year/leap boundaries', () => {
    expect(salesHotelDate('2026-12-31T21:00:00Z', 1)).toBe('2027-01-02');
    expect(salesHotelDate('2028-03-01T07:00:00Z', -1)).toBe('2028-02-29');
    expect(salesHotelDate(undefined, 1)).toBe('');
    expect(salesHotelDate('invalid', 1)).toBe('');
  });
  it('updates automatic dates and clears the suggestion when return is deselected', () => {
    const previous = selected();
    const next = withSalesHotelDates(previous, {
      ...previous,
      outboundOffer: offer('2026-09-12T07:00:00Z'),
      returnOffer: undefined,
    });
    expect(next.hotel.checkIn).toBe('2026-09-12');
    expect(next.hotel.checkOut).toBe('');
  });
  it('preserves manual overrides including an intentionally cleared value', () => {
    const previous = selected();
    const next = withSalesHotelDates(previous, {
      ...previous,
      hotel: {
        ...previous.hotel,
        checkIn: '2026-09-14',
        checkInManual: true,
        checkOut: '',
        checkOutManual: true,
      },
      outboundOffer: offer('2026-09-12T07:00:00Z'),
    });
    expect(next.hotel.checkIn).toBe('2026-09-14');
    expect(next.hotel.checkOut).toBe('');
    const reset = withSalesHotelDates(next, {
      ...next,
      hotel: { ...next.hotel, checkInManual: false, checkOutManual: false },
    });
    expect(reset.hotel.checkIn).toBe('2026-09-12');
    expect(reset.hotel.checkOut).toBe('2026-09-19');
  });
  it('keeps saved legacy draft dates and never invents a return date for a one-way ticket', () => {
    const legacy = { ...base, hotel: { ...base.hotel, checkIn: '2026-09-15' } };
    expect(
      withSalesHotelDates(legacy, {
        ...legacy,
        outboundOffer: offer('2026-09-10T07:00:00Z'),
      }).hotel.checkIn,
    ).toBe('2026-09-15');
    const oneWay = withSalesHotelDates(base, {
      ...base,
      tripType: 'ONE_WAY',
      outboundOffer: offer('2026-09-10T07:00:00Z'),
    });
    expect(oneWay.hotel.checkIn).toBe('2026-09-10');
    expect(oneWay.hotel.checkOut).toBe('');
  });
  it('rejects invalid or incomplete stays, including a short-flight suggested range', () => {
    const state = selected();
    expect(salesHotelValid(state)).toBe(false);
    state.hotel = { ...state.hotel, hotelId: 'hotel', roomTypeId: 'room' };
    expect(salesHotelValid(state)).toBe(true);
    expect(
      salesHotelValid({
        ...state,
        hotel: { ...state.hotel, checkOut: state.hotel.checkIn },
      }),
    ).toBe(false);
    expect(
      salesHotelValid({ ...state, hotel: { ...state.hotel, roomCount: 0 } }),
    ).toBe(false);
  });
  it('sends the manually edited stay through the existing Sales public payload', () => {
    const state = selected();
    state.hotel = {
      ...state.hotel,
      hotelId: 'hotel',
      roomTypeId: 'room',
      checkIn: '2026-09-12',
      checkOut: '2026-09-18',
      checkInManual: true,
      calendarSystem: 'gregorian',
    };
    const payload = salesPayload(state);
    expect(payload.hotelSelection).toMatchObject({
      checkInDate: '2026-09-12',
      checkOutDate: '2026-09-18',
      roomCount: 1,
      singleRoomCount: 0,
      doubleRoomCount: 1,
      extraBedCount: 0,
    });
    expect(payload.hotelSelection).not.toHaveProperty('checkInManual');
    expect(payload.hotelSelection).not.toHaveProperty('calendarSystem');
  });
  it('reports known room capacity immediately and ignores missing rate factors', () => {
    const state = selected();
    state.passengerComposition = { adults: 3, children: 1, infants: 0 };
    state.hotel = {
      ...state.hotel,
      hotelId: 'hotel',
      roomTypeId: 'double',
      roomCount: 1,
    };
    const rates: HotelRoomRateV1[] = [
      {
        roomTypeId: 'double',
        roomTypeName: 'دوتخته',
        factor: '1',
        maxAdults: 2,
        maxChildren: 1,
      },
    ];

    expect(salesHotelCapacityError(state, rates)).toContain(
      'حداکثر ۲ بزرگسال، ۱ کودک ۲–۶، ۰ کودک ۶–۱۲ و ۰ نوزاد',
    );
    expect(salesHotelCapacityError(state, [])).toBeNull();
    expect(
      salesHotelCapacityError(
        { ...state, hotel: { ...state.hotel, roomCount: 2 } },
        rates,
      ),
    ).toBeNull();
  });
});

it('derives floating hotel dates from selected calendar days before flight identity is complete', () => {
  const next = withSalesHotelDates(base, {
    ...base,
    departureDate: '2026-10-12',
    returnDate: '2026-10-20',
    contractFlights: {
      OUTBOUND: {
        departureAt: '',
        arrivalAt: '',
        carrierName: '',
        serviceNumber: '',
        cabinClassCode: 'ECONOMY',
      },
    },
  });
  expect(next.hotel).toMatchObject({
    checkIn: '2026-10-12',
    checkOut: '2026-10-19',
  });
  const changed = withSalesHotelDates(next, {
    ...next,
    departureDate: '2026-10-14',
    returnDate: '2026-10-22',
  });
  expect(changed.hotel).toMatchObject({
    checkIn: '2026-10-14',
    checkOut: '2026-10-21',
  });
  expect(
    withSalesHotelDates(changed, { ...changed, tripType: 'ONE_WAY' }).hotel
      .checkOut,
  ).toBe('');
});

it('ignores the legacy next-day flag for automatic flight-linked check-in', () => {
  const current = selected();
  const next = withSalesHotelDates(current, {
    ...current,
    hotelArrivesNextDay: true,
  });
  expect(next.hotel.checkIn).toBe('2026-09-10');
  expect(next.hotel.checkOut).toBe(current.hotel.checkOut);
  expect(
    withSalesHotelDates(next, { ...next, hotelArrivesNextDay: false }).hotel
      .checkIn,
  ).toBe('2026-09-10');
});

// Exercise the retained strict algorithm separately from the current temporary policy.
vi.mock('@nora/contracts', async (original) => ({
  ...(await original<typeof Contracts>()),
  enforceSalesHotelCapacity: () => true,
}));

it('uses outbound arrival day for overnight flights while retaining manual check-in', () => {
  const outboundOffer = {
    ...offer('2026-10-24T19:00:00Z'),
    arrivalAt: '2026-10-25T02:00:00Z',
  };
  const next = withSalesHotelDates(base, {
    ...base,
    outboundOffer,
    hotelArrivesNextDay: true,
    packageSaleAvailable: true,
    tour: { startsOn: '2026-10-25', endsOn: '2026-10-30' } as NonNullable<
      SalesFormState['tour']
    >,
  });
  expect(next.hotel.checkIn).toBe('2026-10-25');
  expect(next.hotel.checkOut).toBe('2026-10-30');
  const manual = {
    ...next,
    hotel: { ...next.hotel, checkIn: '2026-10-26', checkInManual: true },
  };
  expect(withSalesHotelDates(next, manual).hotel.checkIn).toBe('2026-10-26');
});

it('uses the selected outbound day before floating flight details are complete with a legacy next-day flag', () => {
  const next = withSalesHotelDates(base, {
    ...base,
    departureDate: '2026-10-24',
    hotelArrivesNextDay: true,
    contractFlights: {
      OUTBOUND: {
        departureAt: '',
        arrivalAt: '',
        carrierName: '',
        serviceNumber: '',
        cabinClassCode: 'ECONOMY',
      },
    },
  });
  expect(next.hotel.checkIn).toBe('2026-10-24');
});

it('preserves aggregate legacy flight/hotel dates, age counts, real offer links and a single customer total without passenger identities', () => {
  const current = selected();
  const price = {
    version: 1 as const,
    currencyCode: 'USD',
    daySale: { basis: 'TOTAL' as const, amount: '100' },
    agreed: { basis: 'TOTAL' as const, amount: '100' },
  };
  const state: SalesFormState = {
    ...current,
    legacyContract: true,
    customerId: 'buyer',
    ticket: {
      ...current.ticket,
      outboundOfferId: current.outboundOffer!.id,
      returnOfferId: current.returnOffer!.id,
      outboundDepartureAt: current.outboundOffer!.departureAt,
      outboundArrivalAt: current.outboundOffer!.arrivalAt,
      returnDepartureAt: current.returnOffer!.departureAt,
      returnArrivalAt: current.returnOffer!.arrivalAt,
    },
    passengerComposition: { adults: 2, children: 1, infants: 1 },
    priceEntryMode: 'CONTRACT_TOTAL',
    hotel: {
      ...current.hotel,
      hotelId: 'hotel',
      name: 'Synthetic Hotel',
      roomTypeId: '11111111-1111-4111-8111-111111111111',
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          roomTypeNameSnapshot: 'Standard',
          adults: 2,
          childAges: [5, 1],
        },
      ],
    },
    contractPrices: [{ currencyCode: 'USD', amount: '250' }],
    servicePricing: {
      'flight-outbound': [price],
      'flight-return': [price],
      hotel: [price],
    },
  };
  const payload = salesPayload(state);
  expect(payload.passengers).toEqual([]);
  expect(payload.customerId).toBe('buyer');
  expect(payload.ticketSelections).toHaveLength(2);
  expect(payload.hotelSelection).toMatchObject({
    occupancy: 4,
    checkInDate: '2026-09-10',
    checkOutDate: '2026-09-19',
  });
  const parties = JSON.parse(
    String(payload.services[0]!.metadata!.legacyServicePartiesV2),
  );
  expect(parties.hotel).toEqual({ adults: 2, children: 1, infants: 1 });
  expect(parties['flight-outbound']).toEqual({
    adults: 2,
    children: 1,
    infants: 1,
  });
  expect(payload.services.map((s) => s.kind)).toEqual([
    'FLIGHT',
    'FLIGHT',
    'HOTEL',
  ]);
  expect(
    payload.priceComponents
      .filter((p) => p.type === 'BASE')
      .map((p) => p.amount),
  ).toEqual(['250']);
});
