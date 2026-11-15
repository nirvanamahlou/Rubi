import { localizedFetch } from '@/i18n/localized-fetch';
import { refreshAuthenticatedSession } from './auth-session';
import {
  fiscalRequestHeaders,
  beginFiscalWrite,
} from '@/modules/finance/fiscal-request-state';

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
  const fiscalHeaders =
    typeof window === 'undefined'
      ? null
      : fiscalRequestHeaders(url, baseUrl, options.headers);
  if (fiscalHeaders) options.headers = fiscalHeaders;
  const finish =
    fiscalHeaders &&
    !['GET', 'HEAD', 'OPTIONS'].includes(
      (options.method ?? 'GET').toUpperCase(),
    )
      ? beginFiscalWrite()
      : () => undefined;
  try {
    const response = await localizedFetch(url, options);
    // Retry only an authentication rejection, once. A failed write response is
    // never automatically replayed as a network/server retry.
    if (response.status !== 401 || signal?.aborted) return response;
    if (!(await refreshAuthenticatedSession(baseUrl))) return response;
    if (signal?.aborted) return response;
    return await localizedFetch(url, options);
  } finally {
    finish();
  }
}
