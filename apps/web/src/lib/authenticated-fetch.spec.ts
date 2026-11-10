import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticatedFetch } from './authenticated-fetch';
import { localizedFetch } from '@/i18n/localized-fetch';
import { refreshAuthenticatedSession } from './auth-session';
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: vi.fn() }));
vi.mock('./auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('authenticated transport', () => {
  it('refreshes once while preserving a write body, idempotency key and signal', async () => {
    vi.mocked(localizedFetch)
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.mocked(refreshAuthenticatedSession).mockResolvedValue({
      user: { id: 'synthetic' },
    } as never);
    const result = await authenticatedFetch('/api/action', '/api', {
      method: 'POST',
      body: 'payload',
      headers: { 'Idempotency-Key': 'same-key' },
    });
    expect(result.status).toBe(204);
    expect(localizedFetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(localizedFetch).mock.calls[0]?.[1]).toBe(
      vi.mocked(localizedFetch).mock.calls[1]?.[1],
    );
    expect(vi.mocked(localizedFetch).mock.calls[1]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
      body: 'payload',
      headers: { 'Idempotency-Key': 'same-key' },
      signal: expect.any(AbortSignal),
    });
  });
  it.each([403, 409, 500, 503])('never replays status %i', async (status) => {
    vi.mocked(localizedFetch).mockResolvedValue(new Response(null, { status }));
    expect((await authenticatedFetch('/api/action', '/api')).status).toBe(
      status,
    );
    expect(localizedFetch).toHaveBeenCalledTimes(1);
    expect(refreshAuthenticatedSession).not.toHaveBeenCalled();
  });
  it('keeps caller cancellation and bounds repeated authentication failure', async () => {
    const abort = new AbortController();
    abort.abort();
    vi.mocked(localizedFetch).mockResolvedValue(
      new Response(null, { status: 401 }),
    );
    await authenticatedFetch('/api/action', '/api', { signal: abort.signal });
    expect(refreshAuthenticatedSession).not.toHaveBeenCalled();
    expect(vi.mocked(localizedFetch).mock.calls[0]?.[1]?.signal?.aborted).toBe(
      true,
    );
  });
});
