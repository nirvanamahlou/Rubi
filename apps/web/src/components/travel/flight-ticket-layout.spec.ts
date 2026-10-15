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
