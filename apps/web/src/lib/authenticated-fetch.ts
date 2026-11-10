import { localizedFetch } from '@/i18n/localized-fetch';
import { refreshAuthenticatedSession } from './auth-session';

/** Shared transport only; endpoint schemas and domain errors stay with their owner. */
export async function authenticatedFetch(
  url: string,
  baseUrl: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 30_000, ...request } = init;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = request.signal
    ? AbortSignal.any([request.signal, timeout])
    : timeout;
  const options: RequestInit = {
    credentials: 'include',
    cache: 'no-store',
    ...request,
    signal,
  };
  const response = await localizedFetch(url, options);
  // Retry only an authentication rejection, once. A failed write response is
  // never automatically replayed as a network/server retry.
  if (response.status !== 401 || signal.aborted) return response;
  if (!(await refreshAuthenticatedSession(baseUrl))) return response;
  return localizedFetch(url, options);
}
