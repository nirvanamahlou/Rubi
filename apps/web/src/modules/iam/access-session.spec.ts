import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAccessSession } from './access-session';
import type * as AuthSession from '@/lib/auth-session';
import {
  refreshAuthenticatedSession,
  SessionRefreshUnavailableError,
} from '@/lib/auth-session';
vi.mock('@/lib/auth-session', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthSession>()),
  refreshAuthenticatedSession: vi.fn(),
}));
const actor = {
  userId: 'user',
  sessionId: 'session',
  permissions: ['sales.read'],
  branchIds: ['branch'],
};
const response = (status: number, body: unknown = actor) => ({
  status,
  ok: status === 200,
  json: async () => body,
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe('background access-session validation', () => {
  it('reads current permissions without rotating a healthy session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200)));
    await expect(loadAccessSession('/api/v1')).resolves.toEqual({
      status: 'ready',
      actor,
    });
    expect(refreshAuthenticatedSession).not.toHaveBeenCalled();
  });
  it('silently recovers an expired access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response(401))
        .mockResolvedValueOnce(response(200)),
    );
    vi.mocked(refreshAuthenticatedSession).mockResolvedValue({
      user: { id: 'user' },
    } as never);
    await expect(loadAccessSession('/api/v1')).resolves.toEqual({
      status: 'ready',
      actor,
    });
  });
  it('returns expired only after refresh explicitly denies authentication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401)));
    vi.mocked(refreshAuthenticatedSession).mockResolvedValue(null);
    await expect(loadAccessSession('/api/v1')).resolves.toEqual({
      status: 'expired',
    });
  });
  it('propagates a temporary refresh outage instead of expiring the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401)));
    vi.mocked(refreshAuthenticatedSession).mockRejectedValue(
      new SessionRefreshUnavailableError(),
    );
    await expect(loadAccessSession('/api/v1')).rejects.toBeInstanceOf(
      SessionRefreshUnavailableError,
    );
  });
  it('does not log out on an access response racing a successful rotation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(401)));
    vi.mocked(refreshAuthenticatedSession).mockResolvedValue({
      user: { id: 'user' },
    } as never);
    await expect(loadAccessSession('/api/v1')).rejects.toBeInstanceOf(
      SessionRefreshUnavailableError,
    );
  });
  it.each([502, 503])(
    'propagates temporary access failure %s for a later retry',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(status)));
      await expect(loadAccessSession('/api/v1')).rejects.toBeInstanceOf(
        SessionRefreshUnavailableError,
      );
    },
  );
  it('preserves an explicit access denial', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(403)));
    await expect(loadAccessSession('/api/v1')).resolves.toEqual({
      status: 'forbidden',
    });
  });
  it('rejects malformed access data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, {})));
    await expect(loadAccessSession('/api/v1')).rejects.toBeInstanceOf(
      SessionRefreshUnavailableError,
    );
  });
});
