import { afterEach, describe, expect, it, vi } from 'vitest';
import { customersApi } from './client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined)
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
});

describe('customers browser client', () => {
  it('uses the versioned credentialed API and serializes query mapping', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        meta: { page: 1, pageSize: 25, total: 0 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await customersApi.list({
      search: 'نمونه',
      status: 'active',
      role: 'passenger',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      page: 1,
      pageSize: 25,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/customers?'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain('role=passenger');
  });

  it('sends only an allowlisted explicit reason when sensitive data is requested', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'synthetic-customer' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await customersApi.detail(
      '10000000-0000-4000-8000-000000000001',
      'customer-verification',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/customers/10000000-0000-4000-8000-000000000001',
      ),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-sensitive-read-reason': 'customer-verification',
        }),
      }),
    );
  });

  it('preserves conflict and forbidden status codes', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          code: 'CONCURRENT_MODIFICATION',
          message: 'نسخه تغییر کرده است.',
        }),
      }),
    );
    await expect(
      customersApi.detail('10000000-0000-4000-8000-000000000001'),
    ).rejects.toMatchObject({ status: 409, code: 'CONCURRENT_MODIFICATION' });
  });
});
