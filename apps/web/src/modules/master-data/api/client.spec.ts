import { afterEach, describe, expect, it, vi } from 'vitest';

import { masterDataApi } from './client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
});

describe('master data browser client', () => {
  it('sends credentialed requests to the configured versioned API', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { page: 1, pageSize: 25, total: 0 } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await masterDataApi.list('countries', {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page: 1,
      pageSize: 25,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/master-data/countries?'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('preserves forbidden status for the permission state', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'دسترسی کافی نیست.' } }),
      }),
    );

    await expect(
      masterDataApi.detail('countries', 'record-id'),
    ).rejects.toMatchObject({
      status: 403,
      message: 'دسترسی کافی نیست.',
    });
  });
});
