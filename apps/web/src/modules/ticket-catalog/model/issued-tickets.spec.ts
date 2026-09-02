import { describe, expect, it } from 'vitest';
import {
  countIssuedTicketsByRoute,
  initialIssuedTicketQuery,
  issuedTicketSourceBoundary,
  queryIssuedTickets,
  type IssuedTicketReadModel,
} from './issued-tickets';

const tickets: IssuedTicketReadModel[] = [
  {
    id: 'issued-1',
    contractNumber: 'CTR-1405-100',
    passengerDisplayName: 'مسافر نمونه یک',
    ticketNumber: '096-1000000001',
    pnr: 'ABC123',
    originCityId: 'city-thr',
    origin: 'تهران',
    destinationCityId: 'city-ist',
    destination: 'استانبول',
    airlineId: 'airline-a',
    airline: 'ایرلاین نمونه',
    issuedAt: '2026-09-01T10:00:00.000Z',
    departureAt: '2026-09-10T10:00:00.000Z',
    status: 'issued',
  },
  {
    id: 'issued-2',
    contractNumber: 'CTR-1405-101',
    passengerDisplayName: 'مسافر نمونه دو',
    ticketNumber: '096-1000000002',
    pnr: 'DEF456',
    originCityId: 'city-thr',
    origin: 'تهران',
    destinationCityId: 'city-ist',
    destination: 'استانبول',
    airlineId: 'airline-a',
    airline: 'ایرلاین نمونه',
    issuedAt: '2026-09-02T10:00:00.000Z',
    departureAt: '2026-09-11T10:00:00.000Z',
    status: 'refunded',
  },
];

describe('Issued ticket read-only report', () => {
  it('filters by contract, passenger, ticket or PNR, route, date and status', () => {
    expect(
      queryIssuedTickets(tickets, {
        ...initialIssuedTicketQuery,
        contractNumber: '100',
      }).rows[0]?.id,
    ).toBe('issued-1');
    expect(
      queryIssuedTickets(tickets, {
        ...initialIssuedTicketQuery,
        documentNumber: 'DEF456',
      }).rows[0]?.id,
    ).toBe('issued-2');
    expect(
      queryIssuedTickets(tickets, {
        ...initialIssuedTicketQuery,
        originCityId: 'city-thr',
        destinationCityId: 'city-ist',
        status: 'refunded',
        issuedFrom: '2026-09-02',
        issuedTo: '2026-09-02',
      }).total,
    ).toBe(1);
  });
  it('counts issued documents by route', () => {
    expect(countIssuedTicketsByRoute(tickets)).toEqual([
      {
        key: 'city-thr::city-ist',
        origin: 'تهران',
        destination: 'استانبول',
        count: 2,
      },
    ]);
  });
  it('keeps Reservations as owner and Ticket Catalog read-only', () => {
    expect(issuedTicketSourceBoundary).toEqual({
      owner: 'reservations',
      consumer: 'ticket-catalog',
      access: 'public-contract-read-only',
      persistedHere: false,
    });
  });
});
