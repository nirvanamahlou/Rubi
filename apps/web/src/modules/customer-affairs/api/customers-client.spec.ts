import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  customerAffairsCustomersApi,
  CustomerLookupApiError,
  CUSTOMER_AFFAIRS_CUSTOMERS_CONTRACT_VERSION,
} from './customers-client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined)
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
});

describe('customer affairs public Customers adapter', () => {
  it('supports passengers, server pagination and existing customer resolution', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4190/api/v1';
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await customerAffairsCustomersApi.search(
      {
        search: 'نام',
        status: 'active',
        role: 'all',
        sortBy: 'displayName',
        sortDirection: 'asc',
        page: 2,
        pageSize: 10,
      },
      controller.signal,
    );
    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.searchParams.get('role')).toBe('all');
    expect(url.searchParams.get('page')).toBe('2');
    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal);
    await customerAffairsCustomersApi.detail('person-1', controller.signal);
    expect(fetchMock.mock.calls[1]![0]).toBe(
      'http://localhost:4190/api/v1/customers/person-1',
    );
  });
  it('searches the public versioned Customers endpoint with credentials', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { page: 1, pageSize: 10, total: 0 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await customerAffairsCustomersApi.search({
      search: 'synthetic',
      status: 'active',
      role: 'customer',
      sortBy: 'displayName',
      sortDirection: 'asc',
      page: 1,
      pageSize: 10,
    });
    expect(CUSTOMER_AFFAIRS_CUSTOMERS_CONTRACT_VERSION).toBe(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/customers?'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain('role=customer');
  });

  it.each([
    [401, 'AUTHENTICATION_REQUIRED'],
    [403, 'PERMISSION_DENIED'],
  ])(
    'preserves HTTP %s for real authorization states',
    async (status, code) => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status,
          json: async () => ({ error: { code, message: 'Access denied.' } }),
        }),
      );
      await expect(
        customerAffairsCustomersApi.search({
          search: '',
          status: 'active',
          role: 'customer',
          sortBy: 'displayName',
          sortDirection: 'asc',
          page: 1,
          pageSize: 10,
        }),
      ).rejects.toMatchObject({ status, code });
    },
  );

  it('fails safely when API base URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    await expect(
      customerAffairsCustomersApi.detail('preview-id'),
    ).rejects.toBeInstanceOf(CustomerLookupApiError);
  });
});
