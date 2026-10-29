import { describe, it, expect } from 'vitest';
import {
  ticketPageHtml,
  ticketDocumentHtml,
  ticketAlignmentStyles,
  type TicketLayoutData,
} from './flight-ticket-layout';
const flight = {
  originId: 'teh',
  destinationId: 'ayt',
  departureAt: '2026-10-23T17:50:00Z',
  arrivalAt: '2026-10-23T18:51:00Z',
  carrierName: 'ایران ایرتور',
  serviceNumber: '4512',
  cabinClassCode: 'ECONOMY',
  originAirport: { code: 'IKA', name: 'Imam Khomeini International Airport' },
  destinationAirport: { code: 'AYT', name: 'Antalya Airport' },
};
const data: TicketLayoutData = {
  passengerName: 'Synthetic Passenger',
  issued: true,
  offers: [
    flight,
    {
      ...flight,
      direction: 'RETURN',
      originId: 'ayt',
      destinationId: 'teh',
      originAirport: flight.destinationAirport,
      destinationAirport: flight.originAirport,
      serviceNumber: '7410',
    },
  ],
  transferDirections: [],
};
const brand = { name: 'Synthetic Agency', logoDataUrl: '/brand/niyayesh.png' };
const cities = { teh: 'TEHRAN', ayt: 'ANTALYA' };
const airlines = { 'ایران ایرتور': { name: 'Iran Airtour', code: 'B9' } };
describe('flight ticket placement and English carrier', () => {
  it('uses English names consistently and actual airport codes on each leg', () => {
    const html = ticketPageHtml(data, cities, brand, airlines);
    expect(html).toContain('B9 — Iran Airtour');
    expect(html).toContain('class="carrier" dir="auto">Iran Airtour');
    expect(html).not.toContain('ایران ایرتور');
    expect(html.match(/class="airport-code">IKA/g)).toHaveLength(2);
    expect(html.match(/class="airport-code">AYT/g)).toHaveLength(2);
    expect(html).toContain('4512');
    expect(html).toContain('7410');
    expect(html).toContain('1h 1m');
  });
  it('uses the same aligned and centered styles in PDF and preview', () => {
    expect(ticketDocumentHtml([data], cities, brand, airlines)).toContain(
      ticketAlignmentStyles,
    );
    expect(ticketAlignmentStyles).toContain(
      '.flight-ticket .route{align-items:start}',
    );
    expect(ticketAlignmentStyles).toContain(
      '.flight-ticket .destination{align-self:stretch',
    );
    expect(ticketAlignmentStyles).toContain(
      '.flight-ticket .flight-path{align-self:center;padding-top:0}',
    );
  });
  it('escapes resolved airline names instead of injecting directory HTML', () => {
    expect(
      ticketPageHtml(data, cities, brand, {
        'ایران ایرتور': { name: '<img onerror=bad>' },
      }),
    ).toContain('&lt;img onerror=bad&gt;');
  });
});

it('uses the airport city and IATA instead of the commercial route city on the ticket', () => {
  const original = structuredClone(data);
  const html = ticketPageHtml(
    {
      ...data,
      offers: [
        {
          ...flight,
          destinationAirport: {
            code: 'GZP',
            name: 'Gazipasa Airport',
            cityName: 'Gazipasa',
          },
        },
      ],
    },
    { teh: 'Tehran', ayt: 'Commercial Antalya' },
    { name: 'Test', logoDataUrl: '' },
  );
  expect(html).toContain('Gazipasa');
  expect(html).toContain('GZP');
  expect(html).not.toContain('Commercial Antalya');
  expect(data).toEqual(original);
});

it('displays ARRIVAL/DEPARTURE without changing leg direction, route or source data', () => {
  const before = structuredClone(data);
  const html = ticketPageHtml(data, cities, brand, airlines);
  expect(html).toContain('class="leg outbound"');
  expect(html).toContain('<strong>ARRIVAL</strong>');
  expect(html).toContain('class="leg return"');
  expect(html).toContain('<strong>DEPARTURE</strong>');
  expect(html).not.toContain('<strong>OUTBOUND</strong>');
  expect(html).not.toContain('<strong>RETURN</strong>');
  expect(data).toEqual(before);
  const returningOnly = ticketPageHtml(
    { ...data, offers: [data.offers[1]!] },
    cities,
    brand,
    airlines,
  );
  expect(returningOnly).toContain('<strong>DEPARTURE</strong>');
  expect(returningOnly).not.toContain('<strong>ARRIVAL</strong>');
});
it('uses Latin digits for every displayed value including Persian/Arabic legacy numbers in a Persian UI', () => {
  const original = {
    ...data,
    contractNumber: '۱۲۰۱۲۸',
    eTicketNumber: '١٠٠٠٠٠',
    issuedAt: '2026-10-27T10:00:00Z',
    offers: data.offers.map((o) => ({
      ...o,
      serviceNumber: '۹۷۴۰',
      baggageKg: '٢٠',
    })),
  };
  const before = structuredClone(original);
  const html = ticketDocumentHtml([original], cities, brand, airlines);
  expect(html).toContain('120128');
  expect(html).toContain('100000');
  expect(html).toContain('9740');
  expect(html).toContain('20 KG');
  expect(html).toContain('27 OCT 2026');
  expect(html).toContain('21:20');
  expect(html).not.toMatch(/[\u0660-\u0669\u06f0-\u06f9]/);
  expect(html).toContain('font-family:TicketLatin,');
  expect(html).toContain('vazirmatn-latin-wght-normal.woff2');
  expect(original).toEqual(before);
});
