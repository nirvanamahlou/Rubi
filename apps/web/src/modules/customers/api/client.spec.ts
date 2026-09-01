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
  it('gets real branch names from the public credentialed session response', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const branches = [
      { id: 'synthetic-branch', code: 'TEST', name: 'شعبه آزمایشی' },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { branches } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const [first, second] = await Promise.all([
      customersApi.branchReferences(),
      customersApi.branchReferences(),
    ]);
    expect(first).toEqual(branches);
    expect(second).toEqual(branches);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/iam/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      }),
    );
  });

  it('rejects unavailable names and allows a later retry without invented references', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { branches: [] } }),
      });
    vi.stubGlobal('fetch', fetchMock);
    await expect(customersApi.branchReferences()).rejects.toThrow(
      'دریافت نام شعب مجاز ناموفق بود.',
    );
    await expect(customersApi.branchReferences()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
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
      kind: 'person',
      status: 'active',
      role: 'passenger',
      branchId: '33333333-3333-4333-8333-333333333333',
      acquaintanceMethodId: 'all',
      createdFrom: '2026-08-01',
      createdTo: '2026-08-31',
      updatedFrom: null,
      updatedTo: null,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      page: 1,
      pageSize: 25,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/customers?'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toContain('role=passenger');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('kind=person');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('createdFrom=2026-08-01');
  });

  it('calls read-only customer timeline endpoints without cache', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const customerId = '10000000-0000-4000-8000-000000000001';

    await customersApi.statusHistory(customerId);
    await customersApi.activity(customerId);
    await customersApi.audit(customerId);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toMatch(/status-history|activity|audit/);
      expect(init).toEqual(
        expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
      );
    }
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

  it('refreshes an expired access cookie once and retries the customer request', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { branches: [] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'synthetic-customer' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await customersApi.detail('10000000-0000-4000-8000-000000000001');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://localhost:4000/api/v1/iam/auth/refresh',
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});
