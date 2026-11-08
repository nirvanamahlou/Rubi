import { describe, expect, it } from 'vitest';
import type { SalesContractDetail } from '@nora/contracts';
import { salesListTravelSummary } from './sales-list-summary';
import { contractFlightMetadata } from '@nora/contracts';

const base = {
  departureDate: '2026-10-25',
  servicesDetail: [],
  ticketSelections: [],
  hotelSelection: null,
  passengersDetail: [],
} as unknown as SalesContractDetail;
describe('Sales list travel and passenger projection', () => {
  it.each(['OUTBOUND', 'RETURN'] as const)(
    'places a contract-only %s flight in its own column without a fabricated opposite date',
    (direction) => {
      const flight = {
        clientKey: 'floating-flight',
        kind: 'FLIGHT',
        status: 'NEEDS_RESERVATION_CONFIRMATION',
        metadata: {
          ...contractFlightMetadata({
            version: 1,
            direction,
            originId: '10000000-0000-4000-8000-000000000001',
            destinationId: '10000000-0000-4000-8000-000000000002',
            departureAt: '2026-11-01T22:00:00Z',
            arrivalAt: '2026-11-02T02:00:00Z',
            carrierNameSnapshot: 'SYNTHETIC',
            serviceNumberSnapshot: 'TEST1',
            cabinClassCode: 'ECONOMY',
          }),
          dateCalendarSystem: 'gregorian',
        },
      };
      const result = salesListTravelSummary({
        ...base,
        servicesDetail: [flight] as never,
        hotelSelection: {
          checkInDate: '2026-10-20',
          checkOutDate: '2026-11-05',
        } as never,
      }).travelDates;
      expect(result).toEqual({
        outbound:
          direction === 'OUTBOUND'
            ? { date: '2026-11-02', calendar: 'gregorian' }
            : null,
        returning:
          direction === 'RETURN'
            ? { date: '2026-11-02', calendar: 'gregorian' }
            : null,
      });
    },
  );
  it('retains a booked child without assigning a fabricated age band when birth is unknown', () => {
    expect(
      salesListTravelSummary({
        ...base,
        passengersDetail: [{ ageCategory: 'CHD', birthDate: '' }] as never,
      }).passengerComposition,
    ).toMatchObject({
      childrenUnknownAge: 1,
      children2To6: 0,
      children6To12: 0,
    });
  });
  it('uses exact flight directions, Tehran day and independent recorded calendars', () => {
    const result = salesListTravelSummary({
      ...base,
      servicesDetail: [
        { clientKey: 'out', metadata: { dateCalendarSystem: 'gregorian' } },
        { clientKey: 'back', metadata: { dateCalendarSystem: 'persian' } },
      ] as never,
      ticketSelections: [
        {
          direction: 'RETURN',
          serviceClientKey: 'back',
          departureAt: '2026-11-02T12:00:00Z',
        },
        {
          direction: 'OUTBOUND',
          serviceClientKey: 'out',
          departureAt: '2026-10-25T22:00:00Z',
        },
      ] as never,
    });
    expect(result.travelDates).toEqual({
      outbound: { date: '2026-10-26', calendar: 'gregorian' },
      returning: { date: '2026-11-02', calendar: 'persian' },
    });
  });
  it('keeps a return-only flight in the return column and never presents returnNotBefore as a booked flight', () => {
    expect(
      salesListTravelSummary({
        ...base,
        returnNotBefore: '2026-11-03',
        ticketSelections: [
          { direction: 'RETURN', departureAt: '2026-11-01T12:00:00Z' },
        ] as never,
      }).travelDates?.outbound,
    ).toBeNull();
    expect(
      salesListTravelSummary({ ...base, returnNotBefore: '2026-11-03' })
        .travelDates?.returning,
    ).toBeNull();
  });
  it('uses hotel check-in/out without shifting date-only values', () => {
    expect(
      salesListTravelSummary({
        ...base,
        hotelSelection: {
          checkInDate: '2026-10-25',
          checkOutDate: '2026-11-01',
        } as never,
      }).travelDates,
    ).toEqual({
      outbound: { date: '2026-10-25', calendar: 'gregorian' },
      returning: { date: '2026-11-01', calendar: 'gregorian' },
    });
  });
  it('counts adults, infants and both child age bands at travel time including the sixth birthday', () => {
    const passengersDetail = [
      { ageCategory: 'ADT', birthDate: '1990-01-01' },
      { ageCategory: 'ADT', birthDate: '1991-01-01' },
      { ageCategory: 'CHD', birthDate: '2022-10-25' },
      { ageCategory: 'CHD', birthDate: '2020-10-25' },
      { ageCategory: 'INF', birthDate: '2025-10-25' },
    ] as never;
    expect(
      salesListTravelSummary({ ...base, passengersDetail })
        .passengerComposition,
    ).toEqual({
      adults: 2,
      children2To6: 1,
      children6To12: 1,
      infants: 1,
      childrenUnknownAge: 0,
    });
  });
  it('does not double count overlapping historical service parties or invent child age bands', () => {
    const servicesDetail = [
      {
        clientKey: 'flight',
        kind: 'FLIGHT',
        metadata: {
          legacyServicePartiesV2: JSON.stringify({
            flight: { adults: 2, children: 2, infants: 1 },
            hotel: { adults: 2, children: 1, infants: 0 },
          }),
        },
      },
      { clientKey: 'hotel', kind: 'HOTEL' },
    ] as never;
    expect(
      salesListTravelSummary({ ...base, servicesDetail }).passengerComposition,
    ).toEqual({
      adults: 2,
      children2To6: 0,
      children6To12: 0,
      infants: 1,
      childrenUnknownAge: 2,
    });
  });
});
