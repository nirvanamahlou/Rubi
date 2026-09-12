import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  customerAffairsApi,
  CustomerAffairsApiError,
} from './customer-affairs-client';

const original = process.env.NEXT_PUBLIC_API_BASE_URL;
afterEach(() => {
  vi.unstubAllGlobals();
  if (original === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = original;
});

describe('customer affairs operational API client', () => {
  it('loads branch-scoped leads with credentials and no caching claim', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4190/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { total: 0, page: 1, pageSize: 50 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await customerAffairsApi.leads('نمونه');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/customer-affairs/leads?'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('requires a real successful response before returning mutation data', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4190/api/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          code: 'CONCURRENT_MODIFICATION',
          message: 'تعارض',
        }),
      }),
    );
    await expect(
      customerAffairsApi.action('id', 'reopen', {
        expectedVersion: 1,
        reason: 'test',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONCURRENT_MODIFICATION' });
  });

  it('fails closed without API configuration', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    await expect(customerAffairsApi.dashboard()).rejects.toBeInstanceOf(
      CustomerAffairsApiError,
    );
  });
});
