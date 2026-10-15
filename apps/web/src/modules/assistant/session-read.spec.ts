import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshAuthenticatedSession } from '../../lib/auth-session';
import { readAssistant } from './session-read';

vi.mock('../../lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn(),
}));
vi.mock('../../lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));

describe('assistant session rotation recovery', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    '/api/assistant/executive',
    '/api/assistant/actions/daily-summary',
    '/api/assistant/actions/sales-analysis',
    '/api/assistant/actions/receivables-follow-up',
    '/api/assistant/v2/actions/sales-analysis?startDate=2026-10-01&endDate=2026-10-07',
  ])(
    'recovers a rotated session for %s without changing the request',
    async (path) => {
      const ready = Response.json({ evidence: 'synthetic' });
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(ready);
      vi.stubGlobal('fetch', fetcher);
      vi.mocked(refreshAuthenticatedSession).mockResolvedValue({} as never);
      const signal = new AbortController().signal;
      expect(await readAssistant(path, signal)).toBe(ready);
      expect(refreshAuthenticatedSession).toHaveBeenCalledExactlyOnceWith(
        'http://localhost:4000/api/v1',
      );
      expect(fetcher.mock.calls).toEqual([
        [path, { credentials: 'same-origin', cache: 'no-store', signal }],
        [path, { credentials: 'same-origin', cache: 'no-store', signal }],
      ]);
    },
  );

  it.each([200, 403, 429, 503])(
    'does not refresh or retry status %s',
    async (status) => {
      const response = new Response(null, { status });
      const fetcher = vi.fn().mockResolvedValue(response);
      vi.stubGlobal('fetch', fetcher);
      expect(
        await readAssistant(
          '/api/assistant/executive',
          new AbortController().signal,
        ),
      ).toBe(response);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(refreshAuthenticatedSession).not.toHaveBeenCalled();
    },
  );

  it('preserves invalid-session denial when recovery fails', async () => {
    const denied = new Response(null, { status: 401 });
    const fetcher = vi.fn().mockResolvedValue(denied);
    vi.stubGlobal('fetch', fetcher);
    vi.mocked(refreshAuthenticatedSession).mockResolvedValue(null);
    expect(
      await readAssistant(
        '/api/assistant/executive',
        new AbortController().signal,
      ),
    ).toBe(denied);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('stops after one recovery even if the new session is rejected', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    vi.mocked(refreshAuthenticatedSession).mockResolvedValue({} as never);
    expect(
      (
        await readAssistant(
          '/api/assistant/executive',
          new AbortController().signal,
        )
      ).status,
    ).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(refreshAuthenticatedSession).toHaveBeenCalledTimes(1);
  });

  it('does not issue a stale read after cancellation during recovery', async () => {
    const controller = new AbortController();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    vi.mocked(refreshAuthenticatedSession).mockImplementation(async () => {
      controller.abort();
      return {} as never;
    });
    await expect(
      readAssistant('/api/assistant/executive', controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
