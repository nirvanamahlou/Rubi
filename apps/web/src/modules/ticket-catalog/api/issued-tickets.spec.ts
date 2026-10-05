import { describe, it, expect, vi } from 'vitest';
import {
  issuedReportQuery,
  loadReservationIssuedTickets,
} from './issued-tickets';
import { initialIssuedTicketQuery } from '../model/issued-tickets';
describe('server issued ticket report', () => {
  it('requires ordered issuance dates and exports all pages', () => {
    expect(() => issuedReportQuery(initialIssuedTicketQuery)).toThrow('بازه');
    expect(() =>
      issuedReportQuery({
        ...initialIssuedTicketQuery,
        issuedFrom: '2026-10-05',
        issuedTo: '2026-10-01',
      }),
    ).toThrow();
    const params = new URLSearchParams(
      issuedReportQuery({
        ...initialIssuedTicketQuery,
        issuedFrom: '2026-10-01',
        issuedTo: '2026-10-05',
        page: 9,
        passenger: 'نام',
        originCityId: 'city',
      }),
    );
    expect(params.get('page')).toBeNull();
    expect(params.get('status')).toBeNull();
    expect(params.get('passenger')).toBe('نام');
    expect(params.get('originCityId')).toBe('city');
  });
  it('loads actual public issuance rows without scanning reservation request pages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    try {
      expect(
        await loadReservationIssuedTickets(new AbortController().signal, {
          ...initialIssuedTicketQuery,
          issuedFrom: '2026-10-01',
          issuedTo: '2026-10-05',
        }),
      ).toEqual([]);
      expect(fetcher.mock.calls[0]?.[0]).toContain('/issued-tickets?');
      expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
        credentials: 'include',
        cache: 'no-store',
      });
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
