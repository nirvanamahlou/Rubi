import { refreshAuthenticatedSession } from '../../lib/auth-session';
import { getPublicApiBaseUrl } from '../../lib/environment';

/** Header refresh can rotate the session while a multi-source read is running. */
export async function readAssistant(path: string, signal: AbortSignal) {
  const read = () =>
    fetch(path, { credentials: 'same-origin', cache: 'no-store', signal });
  const response = await read();
  if (response.status !== 401 || signal.aborted) return response;
  const base = getPublicApiBaseUrl();
  if (!base || !(await refreshAuthenticatedSession(base))) return response;
  signal.throwIfAborted();
  // One retry with the fresh browser cookie; never retry permission denial.
  return read();
}
