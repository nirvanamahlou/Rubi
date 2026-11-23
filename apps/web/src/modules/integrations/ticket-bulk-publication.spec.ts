import { expect, it, vi } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  completePublicationFilters,
  matchingPublicationTickets,
  matchingPublicationTicketRows,
  publishTicketSelection,
} from './ticket-bulk-publication';
const filters = {
  originId: 'origin',
  destinationId: 'destination',
  tripType: 'ONEWAY',
  from: '2027-01-26',
  to: '2027-01-26',
  query: '',
};
const offer = (id: string, extra = {}) =>
  ({
    id,
    version: 1,
    branchId: 'branch',
    status: 'ACTIVE',
    originId: 'origin',
    destinationId: 'destination',
    carrierName: 'Synthetic Air',
    serviceNumber: id,
    cabinClassCode: 'ECONOMY',
    departureAt: '2027-01-25T21:00:00Z',
    arrivalAt: '2027-01-25T23:00:00Z',
    remainingCapacity: 5,
    totalCapacity: 10,
    baseStandaloneSalePrice: { amount: '10', currencyCode: 'IRR', revision: 1 },
    ...extra,
  }) as TicketOfferV1;
const label = (row: TicketOfferV1) => row.serviceNumber;
it('retains the exact matched fare rows for display while publishing canonical offer identities', () => {
  const outbound = offer('both-fares', {
    baseRoundTripSalePrices: ['r1', 'r2'].map((returnOfferId) => ({
      returnOfferId,
      amount: '20',
      currencyCode: 'IRR',
      revision: 1,
    })),
  });
  const returns = ['r1', 'r2'].map((id) =>
    offer(id, {
      originId: 'destination',
      destinationId: 'origin',
      departureAt: '2027-02-01T10:00:00Z',
    }),
  );
  const tickets = [outbound, ...returns];
  const before = JSON.stringify(tickets);
  expect(
    matchingPublicationTicketRows(tickets, 'branch', filters, label).map(
      (row) => row.returnOfferId,
    ),
  ).toEqual([null]);
  expect(
    matchingPublicationTicketRows(
      tickets,
      'branch',
      { ...filters, tripType: 'ROUNDTRIP', query: 'r2' },
      label,
    ).map((row) => row.returnOfferId),
  ).toEqual(['r2']);
  expect(
    matchingPublicationTicketRows(
      tickets,
      'branch',
      { ...filters, tripType: '' },
      label,
    ).map((row) => row.returnOfferId),
  ).toEqual([null, 'r1', 'r2']);
  expect(matchingPublicationTickets(tickets, 'branch', filters, label)).toEqual(
    [outbound],
  );
  expect(JSON.stringify(tickets)).toBe(before);
});
it('selects all matching active priced offers in the branch and inclusive Tehran departure-date range', () => {
  const rows = [
    offer('yes'),
    offer('other-branch', { branchId: 'other' }),
    offer('paused', { status: 'PAUSED' }),
    offer('other-route', { destinationId: 'elsewhere' }),
    offer('early', { departureAt: '2027-01-25T10:00:00Z' }),
    offer('late', { departureAt: '2027-01-27T10:00:00Z' }),
    offer('zero', { baseStandaloneSalePrice: { amount: '0' } }),
  ];
  expect(
    matchingPublicationTickets(rows, 'branch', filters, label).map(
      (row) => row.id,
    ),
  ).toEqual(['yes']);
});
it('does not treat a paired-only fare as a priced one-way or include unpriced suggested pairs', () => {
  const outbound = offer('paired', {
    baseStandaloneSalePrice: null,
    baseRoundTripSalePrices: [
      {
        returnOfferId: 'return',
        amount: '20',
        currencyCode: 'IRR',
        revision: 1,
      },
    ],
  });
  const returning = offer('return', {
    originId: 'destination',
    destinationId: 'origin',
    baseStandaloneSalePrice: null,
    departureAt: '2027-02-01T10:00:00Z',
  });
  expect(
    matchingPublicationTickets([outbound, returning], 'branch', filters, label),
  ).toEqual([]);
  expect(
    matchingPublicationTickets(
      [outbound, returning],
      'branch',
      { ...filters, tripType: 'ROUNDTRIP' },
      label,
    ).map((row) => row.id),
  ).toEqual(['paired']);
  expect(
    matchingPublicationTickets(
      [outbound],
      'branch',
      { ...filters, tripType: 'ROUNDTRIP' },
      label,
    ),
  ).toEqual([]);
});
it('deduplicates outbound resources with several priced returns while keeping the query filter', () => {
  const outbound = offer('outbound', {
    baseRoundTripSalePrices: ['r1', 'r2'].map((id) => ({
      returnOfferId: id,
      amount: '20',
      currencyCode: 'IRR',
      revision: 1,
    })),
  });
  const returns = ['r1', 'r2'].map((id) =>
    offer(id, {
      originId: 'destination',
      destinationId: 'origin',
      departureAt: '2027-02-01T10:00:00Z',
    }),
  );
  expect(
    matchingPublicationTickets(
      [outbound, ...returns],
      'branch',
      { ...filters, tripType: 'ROUNDTRIP', query: 'r2' },
      label,
    ).map((row) => row.id),
  ).toEqual(['outbound']);
});
it('requires a complete valid route, trip type and ordered calendar-date range', () => {
  expect(completePublicationFilters(filters)).toBe(true);
  for (const patch of [
    { originId: '' },
    { destinationId: '' },
    { tripType: '' },
    { from: '' },
    { to: '2027-02-30' },
    { from: '2027-01-27' },
  ])
    expect(completePublicationFilters({ ...filters, ...patch })).toBe(false);
});
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const input = () => ({
  branchId: 'branch',
  resourceIds: ['one', 'two'],
  sites: ['nss'],
  baseUrl: '/api/v1',
  signal: new AbortController().signal,
});
it('reads the latest CAS version per site and offer, deduplicates selections and preserves presentation and stop settings', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      response({ enabled: false, version: 8, presentation: { title: 'keep' } }),
    )
    .mockResolvedValueOnce(response({ enabled: true, version: 9 }))
    .mockResolvedValueOnce(response(null))
    .mockResolvedValueOnce(response({ enabled: true, version: 1 }));
  const result = await publishTicketSelection({
    ...input(),
    resourceIds: ['one', 'one'],
    sites: ['nss', 'jahan-bastan', 'nss'],
    fetch: fetcher,
  });
  expect(result.map((row) => row.status)).toEqual(['saved', 'saved']);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(fetcher.mock.calls[0]![0]).toContain(
    '/nss/publications/ticket/one?branchId=branch',
  );
  expect(fetcher.mock.calls[2]![0]).toContain(
    '/jahan-bastan/publications/ticket/one?branchId=branch',
  );
  expect(JSON.parse(fetcher.mock.calls[1]![1]!.body as string)).toEqual({
    enabled: true,
    version: 8,
    branchId: 'branch',
  });
  expect(JSON.parse(fetcher.mock.calls[3]![1]!.body as string)).toEqual({
    enabled: true,
    version: 0,
    branchId: 'branch',
  });
  expect(fetcher.mock.calls[1]![1]!.headers).toMatchObject({
    'x-nora-site-commerce': '1',
  });
});
it('never posts already enabled or stopped publications', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response({ enabled: true, version: 3 }))
    .mockResolvedValueOnce(
      response({ enabled: false, version: 4, salesStopped: true }),
    );
  expect(
    (await publishTicketSelection({ ...input(), fetch: fetcher })).map(
      (row) => row.status,
    ),
  ).toEqual(['already', 'stopped']);
  expect(fetcher.mock.calls.every((call) => call[1]?.method !== 'POST')).toBe(
    true,
  );
});
it('reports a conflict once and continues independent items without retrying or claiming full success', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(null))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Conflict' }), { status: 409 }),
    )
    .mockResolvedValueOnce(response(null))
    .mockResolvedValueOnce(response({ enabled: true, version: 1 }));
  const progress = vi.fn();
  const results = await publishTicketSelection({
    ...input(),
    fetch: fetcher,
    onProgress: progress,
  });
  expect(results.map((row) => row.status)).toEqual(['failed', 'saved']);
  expect(results[0]!.message).toBe('Conflict');
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(progress).toHaveBeenCalledTimes(2);
});
it('stops further network actions on access denial and rejects unknown sites before any request', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(response(null, 403));
  expect(
    (await publishTicketSelection({ ...input(), fetch: fetcher })).every(
      (row) => row.status === 'failed',
    ),
  ).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(
    publishTicketSelection({ ...input(), sites: ['unknown'], fetch: fetcher }),
  ).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not start a write when navigation aborts after reading state', async () => {
  const controller = new AbortController();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    controller.abort();
    return response(null);
  });
  expect(
    await publishTicketSelection({
      ...input(),
      signal: controller.signal,
      fetch: fetcher,
    }),
  ).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
