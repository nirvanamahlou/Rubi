export function manifestRequestKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function')
    return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6]! & 15) | 64;
    bytes[8] = (bytes[8]! & 63) | 128;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join('-');
  }
  // This is request deduplication, not an authentication credential.
  return (
    'manifest-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2) +
    '-' +
    Math.random().toString(36).slice(2)
  );
}

export async function manifestResponseError(
  response: Response,
  fallback: string,
) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.message === 'string'
    ? payload.message
    : typeof payload?.error?.message === 'string'
      ? payload.error.message
      : fallback;
}

export async function requestManifestDownload(
  input: {
    offerId: string;
    fromDate: string;
    toDate: string;
    includePreviouslyExported: boolean;
  },
  request: (path: string, init: RequestInit) => Promise<Response>,
  keys: Map<string, string>,
) {
  const exportFile = (includeAll: boolean) => {
    const scope = [
      input.offerId,
      input.fromDate,
      input.toDate,
      includeAll ? 'all' : 'new',
    ].join(':');
    let key = keys.get(scope);
    if (!key) {
      key = manifestRequestKey();
      keys.set(scope, key);
    }
    return request(
      '/reservations/manifests/tickets/' +
        encodeURIComponent(input.offerId) +
        '.xlsx',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({
          fromDate: input.fromDate,
          toDate: input.toDate,
          includePreviouslyExported: includeAll,
        }),
      },
    );
  };
  const response = await exportFile(input.includePreviouslyExported);
  const retriedWithAll = false;
  if (!response.ok)
    throw new Error(
      await manifestResponseError(response, 'MANIFEST آماده نشد.'),
    );
  const file = await response.blob();
  if (!file.size) throw new Error('فایل MANIFEST خالی است؛ دوباره تلاش کنید.');
  return {
    file,
    retriedWithAll,
    contracts: response.headers.get('X-Nora-Manifest-Contracts') ?? '—',
    passengers: response.headers.get('X-Nora-Manifest-Passengers') ?? '—',
    skippedFinance:
      response.headers.get('X-Nora-Manifest-Skipped-Finance') ?? '0',
  };
}
