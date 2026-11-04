import { describe, it, expect } from 'vitest';
import { ticketOfferMatchesRoute, eligibleTicketReturn } from '../src/travel';
describe('shared flight commercial routes', () => {
  const outbound = {
    originId: 'tehran',
    destinationId: 'kusadasi',
    saleRoutes: [{ originId: 'tehran', destinationId: 'bodrum' }],
    departureAt: '2099-01-01T08:00:00Z',
    arrivalAt: '2099-01-01T10:00:00Z',
  };
  it('admits only explicit pairs without changing canonical endpoints', () => {
    const before = JSON.stringify(outbound);
    expect(
      ticketOfferMatchesRoute(outbound, {
        originId: 'tehran',
        destinationId: 'bodrum',
      }),
    ).toBe(true);
    expect(
      ticketOfferMatchesRoute(outbound, {
        originId: 'bodrum',
        destinationId: 'tehran',
      }),
    ).toBe(false);
    expect(
      ticketOfferMatchesRoute(outbound, {
        originId: 'tehran',
        destinationId: 'izmir',
      }),
    ).toBe(false);
    expect(JSON.stringify(outbound)).toBe(before);
  });
  it('accepts an explicit shared reverse route while preserving date limits', () => {
    const returning = {
      originId: 'bodrum',
      destinationId: 'tehran',
      departureAt: '2099-01-08T10:00:00Z',
      arrivalAt: '2099-01-08T12:00:00Z',
    };
    expect(eligibleTicketReturn(outbound, returning)).toBe(true);
    expect(
      eligibleTicketReturn({ ...outbound, returnMaxDays: 3 }, returning),
    ).toBe(false);
    expect(
      eligibleTicketReturn(outbound, { ...returning, originId: 'unknown' }),
    ).toBe(false);
  });
});
