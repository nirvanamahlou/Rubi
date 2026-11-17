import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TicketOfferV1 } from '@nora/contracts';
import { SiteTicketFacts } from './components/site-ticket-facts';
import { matchingPublicationTicketRows } from './ticket-bulk-publication';
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
    revision: 1,
    amount: '9007199254740993.1250',
    currencyCode: 'IRR',
  },
  baseRoundTripSalePrices: [
    {
      returnOfferId: 'return',
      amount: '500.2500',
      currencyCode: 'USD',
      revision: 1,
    },
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

it.each([
  ['ONEWAY', '', false, false],
  ['ROUNDTRIP', 'TEST-3', false, true],
  ['', '', true, true],
] as const)(
  'renders only legs matched by trip type %s and query %s',
  (tripType, query, showSecond, showThird) => {
    const outbound = {
      ...offer,
      baseRoundTripSalePrices: ['return', 'return-2'].map((returnOfferId) => ({
        returnOfferId,
        amount: '500',
        currencyCode: 'IRR',
        revision: 1,
      })),
    };
    const returning = {
      ...offer,
      id: 'return',
      originId: 'destination',
      destinationId: 'origin',
      serviceNumber: 'TEST-2',
      departureAt: '2027-02-01T20:40:00Z',
    };
    const anotherReturn = {
      ...returning,
      id: 'return-2',
      serviceNumber: 'TEST-3',
    };
    const tickets = [outbound, returning, anotherReturn];
    const rows = matchingPublicationTicketRows(
      tickets,
      offer.branchId,
      {
        originId: 'origin',
        destinationId: 'destination',
        tripType,
        query,
        from: '',
        to: '',
      },
      (row) => row.serviceNumber,
    );
    const html = renderToStaticMarkup(
      <SiteTicketFacts
        offer={outbound}
        tickets={tickets}
        cities={{}}
        returnOfferIds={rows.flatMap((row) =>
          row.returnOfferId ? [row.returnOfferId] : [],
        )}
      />,
    );
    expect(html).toContain('TEST-1');
    expect(html.includes('TEST-2')).toBe(showSecond);
    expect(html.includes('TEST-3')).toBe(showThird);
    if (tripType === 'ONEWAY') expect(html).not.toContain('برگشت');
  },
);

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
