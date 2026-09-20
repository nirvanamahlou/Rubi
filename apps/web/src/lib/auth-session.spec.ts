import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('shared authentication refresh', () => {
  it('deduplicates simultaneous refreshes in the same tab', async () => {
    const session = { user: { id: 'user-id' } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(session),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { refreshAuthenticatedSession } = await import('./auth-session');

    await expect(
      Promise.all([
        refreshAuthenticatedSession('http://localhost/api/v1'),
        refreshAuthenticatedSession('http://localhost/api/v1'),
      ]),
    ).resolves.toEqual([session, session]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries a concurrent-refresh conflict with the newer shared cookie', async () => {
    const session = { user: { id: 'user-id' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 409 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(session),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { refreshAuthenticatedSession } = await import('./auth-session');

    await expect(
      refreshAuthenticatedSession('http://localhost/api/v1'),
    ).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
