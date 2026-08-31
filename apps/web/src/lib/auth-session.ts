import type { LoginResponse } from '@rubi/contracts';

const REFRESH_LOCK_NAME = 'rubi-auth-refresh';
const CONFLICT_RETRY_DELAY_MS = 150;

let refreshInFlight: Promise<LoginResponse | null> | null = null;

async function requestRefresh(baseUrl: string): Promise<LoginResponse | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/iam/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    }).catch(() => null);
    if (response?.ok) {
      return (await response.json()) as LoginResponse;
    }
    if (response?.status !== 409 || attempt === 1) return null;
    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, CONFLICT_RETRY_DELAY_MS),
    );
  }
  return null;
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
  refreshInFlight ??= refreshWithBrowserLock(baseUrl).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
