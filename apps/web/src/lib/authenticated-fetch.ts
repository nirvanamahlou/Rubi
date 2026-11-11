import { localizedFetch } from '@/i18n/localized-fetch';
import { refreshAuthenticatedSession } from './auth-session';

/** Shared transport only; endpoint schemas and domain errors stay with their owner. */
export async function authenticatedFetch(
  url: string,
  baseUrl: string,
  init: RequestInit & { timeoutMs?: number | null } = {},
): Promise<Response> {
  const { timeoutMs = 30_000, ...request } = init;
  const timeout =
    timeoutMs === null ? undefined : AbortSignal.timeout(timeoutMs);
  const signal =
    timeout && request.signal
      ? AbortSignal.any([request.signal, timeout])
      : (timeout ?? request.signal);
  const options: RequestInit = {
    credentials: 'include',
    cache: 'no-store',
    ...request,
    ...(signal ? { signal } : {}),
  };
  const response = await localizedFetch(url, options);
  // Retry only an authentication rejection, once. A failed write response is
  // never automatically replayed as a network/server retry.
  if (response.status !== 401 || signal?.aborted) return response;
  if (!(await refreshAuthenticatedSession(baseUrl))) return response;
  if (signal?.aborted) return response;
  return localizedFetch(url, options);
}
