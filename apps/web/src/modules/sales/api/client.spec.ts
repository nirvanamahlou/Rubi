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
  it('downloads all applied results as a Blob and omits list pagination', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response('PK-test', {
        headers: {
          'content-type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const blob = await salesApi.exportXlsx({
      search: 'TRACK',
      settlementStatus: 'UNPAID',
      page: 3,
      pageSize: 20,
    });
    expect(await blob.text()).toBe('PK-test');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/sales/contracts/export.xlsx?search=TRACK&settlementStatus=UNPAID&sortBy=updatedAt&sortDirection=desc',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
  it('does not download JSON or an access error as an Excel file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(salesApi.exportXlsx({})).rejects.toThrow('Excel');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"مجوز خروجی ندارید"}', { status: 403 }),
        ),
    );
    await expect(salesApi.exportXlsx({})).rejects.toMatchObject({
      status: 403,
      message: 'مجوز خروجی ندارید',
    });
  });
  it('loads a saved contract output with authentication and no cache', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { version: 1 } })),
      );
    vi.stubGlobal('fetch', fetch);
    await salesApi.output('saved-id');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/sales/contracts/saved-id/output',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
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
