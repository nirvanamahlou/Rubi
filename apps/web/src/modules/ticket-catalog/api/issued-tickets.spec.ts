import { describe, expect, it } from 'vitest';
import {
  projectReservationIssuedTickets,
  type ReservationIssuedTicketSourceRow,
} from './issued-tickets';

const row: ReservationIssuedTicketSourceRow = {
  id: 'reservation-1',
  contractVersion: 2,
  receivedAt: '2026-09-21T06:00:00.000Z',
  workflow: { supplierStatus: 'CONFIRMED' },
  snapshot: {
    contractNumber: 'SC-2026-000010',
    passengerAssignments: [
      {
        customerId: 'passenger-1',
        displayNameSnapshot: 'مسافر اول',
        serviceClientKeys: ['flight-outbound'],
      },
      {
        customerId: 'passenger-2',
        displayNameSnapshot: 'مسافر دوم',
        serviceClientKeys: ['hotel-only'],
      },
    ],
    serviceSelections: [
      { clientKey: 'flight-outbound', kind: 'FLIGHT' },
      { clientKey: 'hotel-only', kind: 'HOTEL' },
    ],
    ticketSelections: [
      {
        serviceClientKey: 'flight-outbound',
        direction: 'OUTBOUND',
        offerId: 'offer-1',
        originId: 'tehran',
        destinationId: 'antalya',
        departureAt: '2026-09-30T03:30:00.000Z',
        carrierNameSnapshot: 'IRAN AIRTOUR',
      },
    ],
  },
};

describe('reservation issued ticket projection', () => {
  it('projects only assigned flight passengers and keeps missing official numbers empty', () => {
    expect(
      projectReservationIssuedTickets([row], {
        tehran: 'تهران',
        antalya: 'آنتالیا',
      }),
    ).toEqual([
      expect.objectContaining({
        contractNumber: 'SC-2026-000010',
        passengerDisplayName: 'مسافر اول',
        origin: 'تهران',
        destination: 'آنتالیا',
        ticketNumber: null,
        pnr: null,
        status: 'issued',
      }),
    ]);
  });

  it('shows a cancelled reservation as voided without fabricating rows', () => {
    const cancelled = {
      ...row,
      workflow: { supplierStatus: 'CANCELLED' as const },
    };
    expect(
      projectReservationIssuedTickets([cancelled], {}).map(
        (ticket) => ticket.status,
      ),
    ).toEqual(['voided']);
  });
});
