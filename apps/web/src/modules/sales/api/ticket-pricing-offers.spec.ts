import { afterEach, it, expect, vi } from 'vitest';
import { loadTicketPricingOffers } from './ticket-pricing-offers';
import { ticketPriceRows } from '../model/ticket-price-rows';
import type { TicketOfferV1 } from '@nora/contracts';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('loads historical and future registered flights across every pricing page without reversing their route', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
  const old = {
    id: 'old',
    branchId: 'branch',
    originId: 'tehran',
    destinationId: 'antalya',
    departureAt: '2026-07-10T02:00:00Z',
    cabinClassCode: 'ECONOMY',
  } as TicketOfferV1;
  const future = { ...old, id: 'future', departureAt: '2099-01-01T02:00:00Z' };
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [old], hasMore: true }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [old, future], hasMore: false }),
    });
  vi.stubGlobal('fetch', fetcher);
  const result = await loadTicketPricingOffers();
  expect(result.data.map((o) => o.id)).toEqual(['old', 'future']);
  expect(fetcher.mock.calls[0]![0]).toContain(
    '/offers/management?includePast=true&page=1',
  );
  expect(fetcher.mock.calls[1]![0]).toContain(
    '/offers/management?includePast=true&page=2',
  );
  expect(
    ticketPriceRows(result.data).map((r) => [
      r.offer.originId,
      r.offer.destinationId,
    ]),
  ).toEqual([
    ['tehran', 'antalya'],
    ['tehran', 'antalya'],
  ]);
});
