import type { LoginResponse } from '@nora/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { packagePricingApi } from './client';

const activeSession: LoginResponse = {
  user: {
    id: 'user-1',
    username: 'seller',
    email: null,
    displayName: 'کاربر فروش',
    permissions: ['package_pricing.read'],
    branches: [{ id: 'branch-1', code: 'THR', name: 'تهران' }],
  },
};

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(null),
}));

afterEach(() => vi.unstubAllGlobals());

describe('package pricing API client', () => {
  it('reads the tour and purchase grid only through pricing endpoints', async () => {
    const fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ version: 1, data: [] })),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    await packagePricingApi.tours(activeSession);
    await packagePricingApi.tourCosts('tour-1', activeSession);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4000/api/v1/sales/pricing/tour-departures',
      'http://localhost:4000/api/v1/sales/pricing/tour-costs/tour-1',
    ]);
  });

  it('loads only the server-backed package endpoint with filters', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            version: 1,
            data: [],
            meta: { page: 1, pageSize: 20, total: 0 },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    await packagePricingApi.list(
      { branchId: 'branch-1', search: 'IST', page: 1, pageSize: 20 },
      activeSession,
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/sales/pricing/packages?branchId=branch-1&search=IST&page=1&pageSize=20',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('preserves stable authorization and concurrency failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'CONCURRENT_MODIFICATION' }), {
          status: 409,
        }),
      ),
    );
    await expect(
      packagePricingApi.list({}, activeSession),
    ).rejects.toMatchObject({
      status: 409,
      code: 'CONCURRENT_MODIFICATION',
    });
  });
});
