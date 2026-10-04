import { afterEach, expect, it, vi } from 'vitest';
import {
  readyTicketSearch,
  ticketSearchKey,
  type PreparedTicketSearch,
} from './ticket-search';
const query = {
  originId: 'a',
  destinationId: 'b',
  departureFrom: '2099-10-01',
  departureTo: '2099-10-10',
  page: 1,
};
afterEach(() => vi.useRealTimers());
it('never shares a search across dates, routes, cabin, outbound eligibility, or pages', () => {
  const controller = new AbortController();
  const prepared: PreparedTicketSearch = {
    key: ticketSearchKey(query),
    startedAt: Date.now(),
    signal: controller.signal,
    result: Promise.resolve({ data: [], hasMore: false }),
  };
  expect(
    readyTicketSearch(
      {
        page: 1,
        departureTo: query.departureTo,
        departureFrom: query.departureFrom,
        destinationId: 'b',
        originId: 'a',
      },
      prepared,
    ),
  ).toBe(prepared.result);
  for (const change of [
    { originId: 'b' },
    { destinationId: 'c' },
    { departureFrom: '2099-10-02' },
    { departureTo: '2099-10-11' },
    { page: 2 },
    { outboundOfferId: 'another' },
    { cabinClassCode: 'BUSINESS' as const },
  ])
    expect(
      readyTicketSearch({ ...query, ...change }, prepared),
    ).toBeUndefined();
  controller.abort();
  expect(readyTicketSearch(query, prepared)).toBeUndefined();
});
it('expires prepared searches after ten seconds rather than retaining stale inventory', () => {
  vi.useFakeTimers();
  const prepared: PreparedTicketSearch = {
    key: ticketSearchKey(query),
    startedAt: Date.now(),
    signal: new AbortController().signal,
    result: Promise.resolve({ data: [], hasMore: false }),
  };
  vi.advanceTimersByTime(10000);
  expect(readyTicketSearch(query, prepared)).toBeUndefined();
});
