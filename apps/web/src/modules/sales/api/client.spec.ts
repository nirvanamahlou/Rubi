import { afterEach, describe, expect, it, vi } from 'vitest';
import { salesApi } from './client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(null),
}));

afterEach(() => vi.unstubAllGlobals());
describe('sales API dashboard connection', () => {
  it('loads the configured public endpoint with session credentials and no cache', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { todayContracts: 0 } })),
      );
    vi.stubGlobal('fetch', fetch);
    await expect(salesApi.dashboard()).resolves.toEqual({
      data: { todayContracts: 0 },
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/sales/dashboard',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
  it('reports network failure rather than pretending there are zero contracts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    await expect(salesApi.dashboard()).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
  it('distinguishes an expired session from a failed dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );
    await expect(salesApi.dashboard()).rejects.toMatchObject({
      status: 401,
      message: 'نشست شما پایان یافته است؛ دوباره وارد حساب شوید.',
    });
  });
});
