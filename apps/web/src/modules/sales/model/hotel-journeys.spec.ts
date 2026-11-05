import { expect, it } from 'vitest';
import { readHotelJourneys, type HotelJourneyV1 } from '@nora/contracts';
import {
  emptySalesForm,
  salesPayload,
  type SalesFormState,
} from './sales-form';
import { restoreContractDraft } from './restore-contract-draft';
import { salesHotelJourneyError } from './hotel-journeys';
import { contractPrintHtml } from './contract-print';
import { contractHotelJourneyHtml } from './contract-hotel-journey';
import { printFixture, printReferences } from './contract-print.fixture';
import { amendmentFromContract } from '@/modules/reservations/components/contract-amendment-model';
const leg: HotelJourneyV1 = {
  fromHotelId: 'first',
  toHotelId: 'second',
  mode: 'BUS',
  departureDate: '2027-01-06',
  arrivalDate: '2027-01-06',
  departureTime: '09:00',
  arrivalTime: '13:00',
};
const state: SalesFormState = {
  ...emptySalesForm,
  serviceKinds: ['HOTEL'],
  hotel: {
    ...emptySalesForm.hotel,
    hotelId: 'first',
    name: 'First hotel',
    checkIn: '2027-01-01',
    checkOut: '2027-01-03',
    journeys: [leg],
    additionalStays: [
      {
        countryId: 'country-two',
        hotelId: 'second',
        hotelNameSnapshot: 'Second hotel',
        cityId: 'city-two',
        checkInDate: '2027-01-06',
        checkOutDate: '2027-01-08',
      },
    ],
  },
};
it('roundtrips the independent journey through browser draft, saved service, and amendment without creating inventory or prices', () => {
  const payload = salesPayload(
    restoreContractDraft(JSON.parse(JSON.stringify(state))),
  );
  expect(readHotelJourneys(payload.services)).toEqual([leg]);
  expect(payload.services.map((s) => s.kind)).toEqual(['HOTEL']);
  expect(payload.ticketSelections).toEqual([]);
  expect(payload.hotelSelection?.additionalStays?.[0]).not.toHaveProperty(
    'countryId',
  );
  const saved = {
    ...structuredClone(printFixture.contract),
    hotelSelection: payload.hotelSelection,
    servicesDetail: payload.services,
  } as typeof printFixture.contract;
  expect(readHotelJourneys(amendmentFromContract(saved).services)).toEqual([
    leg,
  ]);
  expect(salesHotelJourneyError(state)).toBeUndefined();
  expect(() =>
    salesPayload({
      ...state,
      hotel: { ...state.hotel, journeys: [{ ...leg, departureTime: '' }] },
    }),
  ).toThrow('کامل');
});
it('removes routes with replaced/deleted endpoints without attaching them to a different hotel', () => {
  const next = {
    ...state,
    hotel: {
      ...state.hotel,
      additionalStays: [
        { ...state.hotel.additionalStays![0]!, hotelId: 'new' },
      ],
    },
  };
  expect(readHotelJourneys(salesPayload(next).services)).toEqual([]);
});
it('prints each route adjacent to the destination hotel with independent dates', () => {
  const payload = salesPayload(state);
  const output = structuredClone(printFixture);
  output.contract.hotelSelection = payload.hotelSelection!;
  output.contract.servicesDetail = payload.services;
  const html = contractPrintHtml(output, printReferences);
  expect(html).toContain('جابه‌جایی بین اقامت‌ها');
  expect(html).toContain('06/01/2027');
  expect(html).toContain('09:00');
  expect(html).toContain('اتوبوس');
  expect(html.indexOf('جابه‌جایی بین اقامت‌ها')).toBeLessThan(
    html.indexOf('data-stay="2"'),
  );
});

it('prints connecting flight details and the last hotel airport route without exposing HTML', () => {
  const airport = {
    id: 'a',
    cityId: 'c',
    countryId: 'country',
    code: 'IST',
    name: 'Istanbul airport',
  };
  const flight: HotelJourneyV1 = {
    ...leg,
    mode: 'FLIGHT',
    flight: {
      airline: '<script>unsafe</script>',
      number: 'TK300',
      cabinClass: 'BUSINESS',
      originAirport: airport,
      destinationAirport: {
        ...airport,
        id: 'b',
        code: 'CDG',
        name: 'Paris airport',
      },
    },
  };
  const html = contractHotelJourneyHtml(
    flight,
    'Istanbul hotel',
    'Paris hotel',
  );
  expect(html).toContain('TK300');
  expect(html).toContain('بیزینس');
  expect(html).toContain('IST');
  expect(html).toContain('CDG');
  expect(html).not.toContain('<script>unsafe');
  expect(html).toContain('&lt;script&gt;');
  const returning = contractHotelJourneyHtml(
    { ...leg, fromHotelId: 'second', toHotelId: null, mode: 'CAR', airport },
    'Last hotel',
    '',
  );
  expect(returning).toContain('مسیر تا فرودگاه برگشت');
  expect(returning).toContain('Last hotel');
  expect(returning).toContain('Istanbul airport (IST)');
});
