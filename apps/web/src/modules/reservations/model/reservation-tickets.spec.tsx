import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SalesReservationRequestV1 } from '@rubi/contracts';
import { FlightTicketSheet } from '@/modules/sales/public/tickets';
import { reservationTickets } from './reservation-tickets';

export const ticketSnapshot: SalesReservationRequestV1 = {
  version: 1,
  requestId: 'request',
  contractId: 'contract',
  contractNumber: 'SC-TEST-01',
  contractVersion: 1,
  customerId: 'p1',
  passengerIds: ['p1', 'p2', 'p3'],
  createdAt: '2026-09-07T00:00:00Z',
  hotelSelection: null,
  selectedTicketOfferIds: ['out', 'back'],
  serviceSelections: [
    {
      clientKey: 'out',
      kind: 'FLIGHT',
      titleSnapshot: 'رفت',
      metadata: { businessOutput: true },
    },
    { clientKey: 'back', kind: 'FLIGHT', titleSnapshot: 'برگشت' },
    {
      clientKey: 'transfer',
      kind: 'TRANSFER',
      titleSnapshot: 'ترانسفر برگشت',
      metadata: { direction: 'RETURN' },
    },
    { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'هتل' },
  ],
  passengerAssignments: [
    {
      customerId: 'p1',
      displayNameSnapshot: 'Synthetic Adult',
      ageCategory: 'ADT',
      serviceClientKeys: ['out', 'back', 'transfer'],
    },
    {
      customerId: 'p2',
      displayNameSnapshot: 'Synthetic Infant',
      ageCategory: 'INF',
      serviceClientKeys: ['back'],
    },
    {
      customerId: 'p3',
      displayNameSnapshot: 'Hotel Only',
      ageCategory: 'CHD',
      serviceClientKeys: ['hotel'],
    },
    {
      customerId: 'other',
      displayNameSnapshot: 'Not in contract',
      ageCategory: 'ADT',
      serviceClientKeys: ['out'],
    },
  ],
  ticketSelections: [
    {
      serviceClientKey: 'back',
      direction: 'RETURN',
      offerId: 'back',
      originId: 'ayt',
      destinationId: 'teh',
      departureAt: '2026-09-26T08:00:00Z',
      arrivalAt: '2026-09-26T11:00:00Z',
      carrierNameSnapshot: 'TEST AIRLINE',
      serviceNumberSnapshot: 'TEST-AYT-03',
      cabinClassCode: 'ECONOMY',
    },
    {
      serviceClientKey: 'out',
      direction: 'OUTBOUND',
      offerId: 'out',
      originId: 'teh',
      destinationId: 'ayt',
      departureAt: '2026-09-19T08:00:00Z',
      arrivalAt: '2026-09-19T11:00:00Z',
      carrierNameSnapshot: 'TEST AIRLINE',
      serviceNumberSnapshot: 'TEST-AYT-01',
      cabinClassCode: 'ECONOMY',
    },
  ],
};

describe('saved reservation passenger tickets', () => {
  it('reopens identically from serialized saved data and leaves the snapshot intact', () => {
    const saved = JSON.stringify(ticketSnapshot);
    expect(reservationTickets(JSON.parse(saved))).toEqual(
      reservationTickets(ticketSnapshot),
    );
    expect(JSON.stringify(ticketSnapshot)).toBe(saved);
  });
  it('orders outbound/return and respects each passenger’s assignments including infants', () => {
    const [adult, infant] = reservationTickets(ticketSnapshot);
    expect(reservationTickets(ticketSnapshot)).toHaveLength(2);
    expect(adult?.offers.map((offer) => offer.serviceNumber)).toEqual([
      'TEST-AYT-01',
      'TEST-AYT-03',
    ]);
    expect(infant?.offers.map((offer) => offer.serviceNumber)).toEqual([
      'TEST-AYT-03',
    ]);
    expect(adult?.transferDirections).toEqual(['RETURN']);
    expect(infant?.transferDirections).toEqual([]);
    expect(adult?.offers.map((offer) => offer.businessOutput)).toEqual([
      true,
      false,
    ]);
  });
  it.each([
    { passengerAssignments: undefined },
    { ticketSelections: undefined },
    { passengerIds: [] },
  ])('does not guess missing legacy assignments or flights: %s', (patch) => {
    const legacy: SalesReservationRequestV1 = JSON.parse(
      JSON.stringify({ ...ticketSnapshot, ...patch }),
    );
    expect(reservationTickets(legacy)).toEqual([]);
  });
  it('renders the saved contract reference, passenger and flight with no payment information', () => {
    const data = reservationTickets(ticketSnapshot)[0]!;
    const html = renderToStaticMarkup(
      <FlightTicketSheet
        data={data}
        cityName={(id) => (id === 'teh' ? 'Tehran' : 'Antalya')}
      />,
    );
    expect(html).toContain('SC-TEST-01');
    expect(html).toContain('Synthetic Adult');
    expect(html).toContain('TEST-AYT-01');
    expect(html).toContain('Antalya');
    expect(html).toContain('DRAFT');
    expect(html).not.toContain('PAYMENT');
    expect(html).not.toContain('Synthetic Infant');
  });
  it('escapes stored names rather than executing markup', () => {
    const data = {
      ...reservationTickets(ticketSnapshot)[0]!,
      passengerName: '<script>alert(1)</script>',
    };
    expect(
      renderToStaticMarkup(
        <FlightTicketSheet data={data} cityName={() => '—'} />,
      ),
    ).toContain('&lt;script&gt;');
  });
});
