import { describe, it, expect } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  activeTourTickets,
  changeTourTicketDate,
  tourDatesAfterOutbound,
  tourTicketDates,
  tourTicketDays,
  tourTicketsForDate,
} from './tour-departure-tickets';
describe('tour departure ticket selection', () => {
  it('derives one-way dates from actual flights, including midnight arrival', () => {
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

  it('marks active branch dates and filters on the Tehran day across midnight', () => {
    const rows = [
      {
        id: 'before',
        departureAt: '2026-11-09T20:29:59Z',
        status: 'ACTIVE',
        branchId: 'b',
      },
      {
        id: 'first',
        departureAt: '2026-11-09T20:30:00Z',
        status: 'ACTIVE',
        branchId: 'b',
      },
      {
        id: 'last',
        departureAt: '2026-11-10T20:29:59Z',
        status: 'ACTIVE',
        branchId: 'b',
      },
      {
        id: 'after',
        departureAt: '2026-11-10T20:30:00Z',
        status: 'ACTIVE',
        branchId: 'b',
      },
      {
        id: 'paused',
        departureAt: '2026-11-12T09:00:00Z',
        status: 'PAUSED',
        branchId: 'b',
      },
      {
        id: 'other',
        departureAt: '2026-11-13T09:00:00Z',
        status: 'ACTIVE',
        branchId: 'other',
      },
    ] as TicketOfferV1[];
    const active = activeTourTickets(rows, 'b');
    expect(tourTicketDays(active)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
    ]);
    expect(tourTicketsForDate(active, '2026-11-10').map((o) => o.id)).toEqual([
      'first',
      'last',
    ]);
    expect(tourTicketsForDate(active, '')).toEqual(active);
    expect(tourTicketsForDate(active, '2026-11-15')).toEqual([]);
  });

  it('preserves the requested return date when selecting or publishing an outbound ticket', () => {
    const flight = {
      departureAt: '2026-11-10T19:00:00Z',
      arrivalAt: '2026-11-10T22:00:00Z',
    };
    expect(tourDatesAfterOutbound(flight, '2026-11-17', true)).toEqual({
      start: '2026-11-10',
      end: '2026-11-17',
    });
    expect(tourDatesAfterOutbound(flight, '', true).end).toBe('');
    expect(tourDatesAfterOutbound(flight, '2026-11-09', true).end).toBe('');
    expect(tourDatesAfterOutbound(flight, '2026-11-17', false)).toEqual({
      start: '2026-11-10',
      end: '2026-11-11',
    });
  });

  it('clears stale tickets on date changes without clearing an independent valid return', () => {
    const current = {
      dates: { start: '2026-11-10', end: '2026-11-17' },
      outbound: 'out',
      returning: 'back',
    };
    expect(changeTourTicketDate(current, 'out', '2026-11-10', true)).toBe(
      current,
    );
    expect(changeTourTicketDate(current, 'back', '2026-11-17', true)).toBe(
      current,
    );
    expect(changeTourTicketDate(current, 'out', '2026-11-12', true)).toEqual({
      dates: { start: '2026-11-12', end: '2026-11-17' },
      outbound: '',
      returning: 'back',
    });
    expect(changeTourTicketDate(current, 'out', '2026-11-20', true)).toEqual({
      dates: { start: '2026-11-20', end: '' },
      outbound: '',
      returning: '',
    });
    expect(changeTourTicketDate(current, 'back', '2026-11-18', true)).toEqual({
      dates: { start: '2026-11-10', end: '2026-11-18' },
      outbound: 'out',
      returning: '',
    });
    expect(changeTourTicketDate(current, 'out', '', false)).toEqual({
      dates: { start: '', end: '' },
      outbound: '',
      returning: '',
    });
  });
});
