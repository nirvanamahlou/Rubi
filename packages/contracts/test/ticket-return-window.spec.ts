import { describe, expect, it } from 'vitest';
import {
  eligibleTicketReturn,
  ticketReturnBounds,
  validReturnWindow,
} from '../src/travel/ticket-return-window';
const outbound = {
  originId: 'a',
  destinationId: 'b',
  departureAt: '2026-10-03T20:00:00Z',
  arrivalAt: '2026-10-04T01:00:00Z',
  returnMinDays: 2,
  returnMaxDays: 16,
};
const back = (departureAt: string) => ({
  originId: 'b',
  destinationId: 'a',
  departureAt,
  arrivalAt: new Date(Date.parse(departureAt) + 3600000).toISOString(),
});
describe('ticket return day window', () => {
  it('counts Tehran calendar dates inclusively, including a later-week return', () => {
    expect(eligibleTicketReturn(outbound, back('2026-10-05T00:00:00Z'))).toBe(
      true,
    );
    expect(eligibleTicketReturn(outbound, back('2026-10-19T19:59:59Z'))).toBe(
      true,
    );
    expect(eligibleTicketReturn(outbound, back('2026-10-19T20:30:00Z'))).toBe(
      false,
    );
    expect(eligibleTicketReturn(outbound, back('2026-10-04T10:00:00Z'))).toBe(
      false,
    );
  });
  it('returns exact inclusive bounds for the database query', () => {
    const bounds = ticketReturnBounds(outbound);
    expect(bounds.from.toISOString()).toBe('2026-10-04T20:30:00.000Z');
    expect(bounds.to?.toISOString()).toBe('2026-10-19T20:29:59.999Z');
  });
  it('preserves legacy unrestricted returns while rejecting reversed routes and pre-arrival returns', () => {
    const legacy = { ...outbound, returnMinDays: null, returnMaxDays: null };
    expect(eligibleTicketReturn(legacy, back('2027-01-01T10:00:00Z'))).toBe(
      true,
    );
    expect(eligibleTicketReturn(legacy, back('2026-10-03T21:00:00Z'))).toBe(
      false,
    );
    expect(
      eligibleTicketReturn(legacy, {
        ...back('2026-10-05T10:00:00Z'),
        originId: 'c',
      }),
    ).toBe(false);
  });
  it('validates optional independent limits and rejects fractions, reversed limits and excess days', () => {
    expect(validReturnWindow(null, 16)).toBe(true);
    expect(validReturnWindow(2, null)).toBe(true);
    expect(validReturnWindow(3, 2)).toBe(false);
    expect(validReturnWindow(1.5, 2)).toBe(false);
    expect(validReturnWindow(0, 366)).toBe(false);
  });
});
