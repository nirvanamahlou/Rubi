import { localizedFetch } from '@/i18n/localized-fetch';
import { refreshAuthenticatedSession } from './auth-session';

/** Shared transport only; endpoint schemas and domain errors stay with their owner. */
export async function authenticatedFetch(
  url: string,
  baseUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  const timeout = AbortSignal.timeout(30_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  const options: RequestInit = {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    signal,
  };
  const response = await localizedFetch(url, options);
  // Retry only an authentication rejection, once. A failed write response is
  // never automatically replayed as a network/server retry.
  if (response.status !== 401 || signal.aborted) return response;
  if (!(await refreshAuthenticatedSession(baseUrl))) return response;
  return localizedFetch(url, options);
}
