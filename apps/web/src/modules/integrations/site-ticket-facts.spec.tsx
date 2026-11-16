import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TicketOfferV1 } from '@nora/contracts';
import { SiteTicketFacts } from './components/site-ticket-facts';
const offer: TicketOfferV1 = {
  id: 'outbound',
  version: 1,
  branchId: 'synthetic-branch',
  status: 'ACTIVE',
  originId: 'origin',
  destinationId: 'destination',
  carrierName: 'Synthetic Air',
  serviceNumber: 'TEST-1',
  cabinClassCode: 'ECONOMY',
  departureAt: '2027-01-25T20:40:00Z',
  arrivalAt: '2027-01-25T22:35:00Z',
  remainingCapacity: 0,
  totalCapacity: 61,
  baseStandaloneSalePrice: {
    amount: '9007199254740993.1250',
    currencyCode: 'IRR',
  },
  baseRoundTripSalePrices: [
    { returnOfferId: 'return', amount: '500.2500', currencyCode: 'USD' },
  ],
};
it('shows compact flight facts with a separate route and defined return leg, keeping Tehran time and zero remaining seats', () => {
  const returning = {
    ...offer,
    id: 'return',
    serviceNumber: 'TEST-2',
    departureAt: '2027-02-01T20:40:00Z',
  };
  const html = renderToStaticMarkup(
    <SiteTicketFacts
      offer={offer}
      tickets={[returning]}
      cities={{ origin: 'تهران', destination: 'کیش' }}
    />,
  );
  for (const text of [
    'مبدأ',
    'مقصد',
    'تهران',
    'کیش',
    'ظرفیت کلاس',
    'مانده',
    'رفت',
    'برگشت',
    'TEST-1',
    'TEST-2',
  ])
    expect(html).toContain(text);
  expect(html).toContain('۰');
  expect(html).toContain('۶۱');
  expect(html).toContain('۰:۱۰');
  expect(html).toContain('dateTime="2027-02-01T20:40:00Z"');
  expect(html).not.toContain('9007199254740993.1250');
});
it('does not invent return legs or publishable pairs when the referenced return is missing', () => {
  const html = renderToStaticMarkup(
    <SiteTicketFacts offer={offer} tickets={[]} cities={{}} />,
  );
  expect(html).toContain('پرواز');
  expect(html).not.toContain('برگشت');
  expect(html).not.toContain('500.2500');
});

it('uses the same Gregorian foreign-flight date rule as ticket pricing', () => {
  const html = renderToStaticMarkup(
    <SiteTicketFacts
      offer={offer}
      tickets={[]}
      cities={{}}
      cityCountries={{ destination: 'TR' }}
    />,
  );
  expect(html).toContain('2027');
  expect(html).not.toContain('۱۴۰۵');
});
