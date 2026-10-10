import { browserDisplayLanguage } from './language';

/** Application requests keep their body, credentials and concurrency headers. */
export function localizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const language = browserDisplayLanguage();
  // Persian is the existing API default. Preserve caller options byte-for-byte.
  if (language === 'fa') return fetch(input, init);
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', language);
  const original = init?.headers;
  const forwarded =
    original && !Array.isArray(original) && !(original instanceof Headers)
      ? {
          ...original,
          ...(Object.keys(original).some(
            (key) => key.toLowerCase() === 'accept-language',
          )
            ? {}
            : { 'Accept-Language': language }),
        }
      : headers;
  return fetch(input, { ...init, headers: forwarded });
}
