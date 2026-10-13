import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchMarketingProcess,
  MarketingProcessApiError,
} from './process-client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3101',
}));

describe('marketing process client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the authenticated process projection', async () => {
    const payload = {
      data: {
        contractVersion: 'marketing.process.v1',
        generatedAt: '2026-09-23T00:00:00.000Z',
        persistenceStatus: 'INFRASTRUCTURE_PENDING',
        stages: [],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMarketingProcess()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3101/marketing/process',
      expect.objectContaining({
        credentials: 'include',
        headers: { accept: 'application/json' },
      }),
    );
  });

  it('preserves the API status and safe error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'دسترسی مجاز نیست.' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    const error = await fetchMarketingProcess().catch((cause) => cause);
    expect(error).toBeInstanceOf(MarketingProcessApiError);
    expect(error).toMatchObject({
      message: 'دسترسی مجاز نیست.',
      status: 403,
    });
  });
});
