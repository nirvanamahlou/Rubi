import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('shared authentication refresh', () => {
  it.each([401, 403])(
    'ends the session only for an authoritative %s denial',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
      const { refreshAuthenticatedSession } = await import('./auth-session');
      await expect(refreshAuthenticatedSession('/api/v1')).resolves.toBeNull();
    },
  );

  it.each([429, 500, 502, 503])(
    'does not report a temporary %s failure as logout',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
      const { refreshAuthenticatedSession, SessionRefreshUnavailableError } =
        await import('./auth-session');
      await expect(
        refreshAuthenticatedSession('/api/v1'),
      ).rejects.toBeInstanceOf(SessionRefreshUnavailableError);
    },
  );

  it('keeps network failure recoverable and releases the single-flight lock', async () => {
    const session = { user: { id: 'user-id' } };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => session,
      });
    vi.stubGlobal('fetch', fetchMock);
    const { refreshAuthenticatedSession, SessionRefreshUnavailableError } =
      await import('./auth-session');
    await expect(refreshAuthenticatedSession('/api/v1')).rejects.toBeInstanceOf(
      SessionRefreshUnavailableError,
    );
    await expect(refreshAuthenticatedSession('/api/v1')).resolves.toEqual(
      session,
    );
  });

  it('does not turn a still-busy browser rotation into expiry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409 }),
    );
    const { refreshAuthenticatedSession, SessionRefreshUnavailableError } =
      await import('./auth-session');
    await expect(refreshAuthenticatedSession('/api/v1')).rejects.toBeInstanceOf(
      SessionRefreshUnavailableError,
    );
  });

  it('does not dispatch recovered identity for an invalid successful response', async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    const { refreshAuthenticatedSession, SessionRefreshUnavailableError } =
      await import('./auth-session');
    await expect(refreshAuthenticatedSession('/api/v1')).rejects.toBeInstanceOf(
      SessionRefreshUnavailableError,
    );
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('never shares refresh results between separate API origins', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 'user-id' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { refreshAuthenticatedSession } = await import('./auth-session');
    await Promise.all([
      refreshAuthenticatedSession('http://localhost:4116/api/v1'),
      refreshAuthenticatedSession('http://localhost:4000/api/v1'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('notifies mounted UI when a session is recovered', async () => {
    const session = { user: { id: 'user-id' } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(session),
    });
    const dispatchEvent = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { dispatchEvent });

    const { AUTH_SESSION_RECOVERED_EVENT, refreshAuthenticatedSession } =
      await import('./auth-session');

    await expect(
      refreshAuthenticatedSession('http://localhost/api/v1'),
    ).resolves.toEqual(session);
    const dispatchedEvent = dispatchEvent.mock.calls[0]?.[0] as CustomEvent;
    expect(dispatchedEvent.type).toBe(AUTH_SESSION_RECOVERED_EVENT);
    expect(dispatchedEvent.detail).toEqual(session);
  });

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
