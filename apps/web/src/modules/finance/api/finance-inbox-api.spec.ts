import { afterEach, describe, expect, it, vi } from 'vitest';

import { financeInboxApi } from './finance-inbox-api';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4200/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(null),
}));

afterEach(() => vi.unstubAllGlobals());

describe('Finance inbox API', () => {
  it('loads only the authenticated no-cache Finance projection', async () => {
    const payload = {
      version: 1,
      generatedAt: '2026-09-13T00:00:00Z',
      items: [],
      sources: [],
    };
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(financeInboxApi.list()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/v1/finance/inbox',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('reports permission and network failures without returning fake rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    );
    await expect(financeInboxApi.list()).rejects.toMatchObject({
      status: 403,
      message: 'برای مشاهده کارتابل مالی مجوز ندارید.',
    });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(financeInboxApi.list()).rejects.toMatchObject({ status: 0 });
  });
});
