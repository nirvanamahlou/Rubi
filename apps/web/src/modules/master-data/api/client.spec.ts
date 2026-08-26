import { afterEach, describe, expect, it, vi } from 'vitest';

import { masterDataApi } from './client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined)
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
});

describe('master data browser client', () => {
  it('sends credentialed requests to the configured versioned API', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { page: 1, pageSize: 25, total: 0 },
      }),
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

  it('downloads a credentialed XLSX file from the direct endpoint', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const blob = new Blob(['xlsx']);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) =>
          name === 'content-disposition'
            ? 'attachment; filename="master-data-countries.xlsx"'
            : null,
      },
      blob: async () => blob,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await masterDataApi.downloadExcel({
      resource: 'countries',
      format: 'xlsx',
      filters: {
        search: '',
        status: 'all',
        sortBy: 'name',
        sortDirection: 'asc',
      },
      columns: ['code', 'name', 'status', 'updatedAt'],
      locale: 'fa-IR',
      timezone: 'Asia/Tehran',
    });

    expect(result).toEqual({ blob, fileName: 'master-data-countries.xlsx' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/master-data/exports/xlsx/download',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
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
