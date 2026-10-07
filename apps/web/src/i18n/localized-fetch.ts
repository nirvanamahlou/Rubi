import { browserDisplayLanguage } from './language';

/** Application requests keep their body, credentials and concurrency headers. */
export function localizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', browserDisplayLanguage());
  return fetch(input, { ...init, headers });
}
