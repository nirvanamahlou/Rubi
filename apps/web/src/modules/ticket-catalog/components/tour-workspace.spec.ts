import { describe, it, expect } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { activeTourTickets, tourTicketDates } from './tour-departure-tickets';
describe('tour departure ticket selection', () => {
  it('derives Tehran dates from actual flights, including midnight arrival without an independent date choice', () => {
    expect(
      tourTicketDates({
        departureAt: '2099-01-01T19:00:00Z',
        arrivalAt: '2099-01-01T22:00:00Z',
      }),
    ).toEqual({ start: '2099-01-01', end: '2099-01-02' });
  });
  it('uses the actual return flight day when selected', () => {
    expect(
      tourTicketDates(
        {
          departureAt: '2099-01-01T19:00:00Z',
          arrivalAt: '2099-01-01T22:00:00Z',
        },
        { departureAt: '2099-01-07T22:00:00Z' },
      ),
    ).toEqual({ start: '2099-01-01', end: '2099-01-08' });
  });
  it('shows only active tickets of the selected branch regardless of their calendar day', () => {
    const rows = [
      { id: 'a', status: 'ACTIVE', branchId: 'b' },
      { id: 'x', status: 'PAUSED', branchId: 'b' },
      { id: 'c', status: 'ACTIVE', branchId: 'other' },
    ] as TicketOfferV1[];
    expect(activeTourTickets(rows, 'b').map((o) => o.id)).toEqual(['a']);
  });
});
