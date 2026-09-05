import { describe, expect, it } from 'vitest';
import type { TicketOfferV1 } from '@rubi/contracts';
import {
  emptySalesForm,
  salesDetailSteps,
  salesHotelDate,
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
  it('combines hotel into the flight step regardless of service selection order', () => {
    expect(salesDetailSteps(base)).toEqual(['FLIGHT']);
    expect(
      salesDetailSteps({ ...base, serviceKinds: ['HOTEL', 'FLIGHT', 'VISA'] }),
    ).toEqual(['FLIGHT', 'VISA']);
    expect(
      salesDetailSteps({ ...base, serviceKinds: ['HOTEL', 'VISA'] }),
    ).toEqual(['HOTEL', 'VISA']);
  });
  it('defaults to the day after outbound and day before return', () => {
    expect(selected().hotel).toMatchObject({
      checkIn: '2026-09-11',
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
    expect(next.hotel.checkIn).toBe('2026-09-13');
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
    expect(reset.hotel.checkIn).toBe('2026-09-13');
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
    expect(oneWay.hotel.checkIn).toBe('2026-09-11');
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
    };
    const payload = salesPayload(state);
    expect(payload.hotelSelection).toMatchObject({
      checkInDate: '2026-09-12',
      checkOutDate: '2026-09-18',
    });
    expect(payload.hotelSelection).not.toHaveProperty('checkInManual');
  });
});
