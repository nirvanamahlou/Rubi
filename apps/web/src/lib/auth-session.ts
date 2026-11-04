import type { LoginResponse } from '@nora/contracts';

const REFRESH_LOCK_NAME = 'nora-auth-refresh';
const CONFLICT_RETRY_DELAY_MS = 150;
export const AUTH_SESSION_RECOVERED_EVENT = 'nora:auth-session-recovered';

const refreshesInFlight = new Map<string, Promise<LoginResponse | null>>();

export class SessionRefreshUnavailableError extends Error {
  constructor() {
    super('ارتباط برقرار نشد؛ دوباره تلاش کنید.');
    this.name = 'SessionRefreshUnavailableError';
  }
}

async function requestRefresh(baseUrl: string): Promise<LoginResponse | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/iam/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => {
      throw new SessionRefreshUnavailableError();
    });
    if (response?.ok) {
      const session = (await response
        .json()
        .catch(() => null)) as LoginResponse | null;
      if (!session?.user?.id) throw new SessionRefreshUnavailableError();
      if (typeof window !== 'undefined')
        window.dispatchEvent(
          new CustomEvent<LoginResponse>(AUTH_SESSION_RECOVERED_EVENT, {
            detail: session,
          }),
        );
      return session;
    }
    // Only an authoritative authentication denial ends a session. A failed
    // connection, busy rotation or server outage does not revoke the cookie.
    if (response.status === 401 || response.status === 403) return null;
    if (response.status !== 409 || attempt === 1)
      throw new SessionRefreshUnavailableError();
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, CONFLICT_RETRY_DELAY_MS),
    );
  }
  throw new SessionRefreshUnavailableError();
}

async function refreshWithBrowserLock(
  baseUrl: string,
): Promise<LoginResponse | null> {
  const refresh = () => requestRefresh(baseUrl);
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request(REFRESH_LOCK_NAME, refresh);
  return refresh();
}

export function refreshAuthenticatedSession(
  baseUrl: string,
): Promise<LoginResponse | null> {
  const key = baseUrl.replace(/\/$/, '');
  let refresh = refreshesInFlight.get(key);
  if (!refresh) {
    refresh = refreshWithBrowserLock(key).finally(() => {
      refreshesInFlight.delete(key);
    });
    refreshesInFlight.set(key, refresh);
  }
  return refresh;
}
