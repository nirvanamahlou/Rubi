import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { toursApi } from './tours';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const offer = (id: string, departureAt: string) =>
  ({ id, departureAt }) as TicketOfferV1;

describe('tour departure ticket range', () => {
  it('sends a versioned published-offer status change to the backend', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'offer-1', version: 8, status: 'ACTIVE' },
      }),
    });
    vi.stubGlobal('fetch', fetcher);

    await toursApi.updateOfferStatus('offer-1', 7, 'ACTIVE');

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/ticket-catalog/offers/offer-1/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: 7, status: 'ACTIVE' }),
      }),
    );
  });

  it('requests the selected inclusive range and removes offers outside Tehran days', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:4000/api/v1');
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          offer('before', '2026-09-19T20:29:59.999Z'),
          offer('start', '2026-09-19T20:30:00.000Z'),
          offer('middle', '2026-09-21T08:00:00.000Z'),
          offer('end', '2026-09-22T20:29:59.999Z'),
          offer('after', '2026-09-22T20:30:00.000Z'),
        ],
        hasMore: false,
      }),
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(
      toursApi.offers('origin', 'destination', '2026-09-20', '2026-09-22'),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'start' }),
      expect.objectContaining({ id: 'middle' }),
      expect.objectContaining({ id: 'end' }),
    ]);
    const url = String(fetcher.mock.calls[0]![0]);
    expect(url).toContain('departureFrom=2026-09-19T20%3A30%3A00.000Z');
    expect(url).toContain('departureTo=2026-09-22');
  });
});
