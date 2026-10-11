const tokenCookie = (raw: string | null) => {
  const matches = (raw ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('nora_access='));
  return matches.length === 1 &&
    /^nora_access=[A-Za-z0-9_.%~-]{1,8192}$/.test(matches[0]!)
    ? matches[0]
    : null;
};

/** Transport only: authentication and tools live in the independent service. */
export async function proxyExecutiveSnapshot(
  request: Request,
  configuredUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const headers = {
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  };
  const error = (status: number, code: string) =>
    Response.json({ error: { code } }, { status, headers });
  const cookie = tokenCookie(request.headers.get('cookie'));
  if (!cookie) return error(401, 'UNAUTHENTICATED');
  if (new URL(request.url).search) return error(400, 'INVALID_REQUEST');
  if (!configuredUrl) return error(503, 'NOT_CONFIGURED');
  try {
    const target = new URL(configuredUrl);
    if (
      target.username ||
      target.password ||
      target.search ||
      target.hash ||
      target.pathname !== '/' ||
      (target.protocol !== 'https:' &&
        !(
          target.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
        ))
    )
      return error(503, 'NOT_CONFIGURED');
    target.pathname = '/v1/executive/snapshot';
    const response = await fetcher(target, {
      method: 'GET',
      headers: { accept: 'application/json', cookie },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    });
    if (!response.ok)
      return error(
        [401, 403, 429].includes(response.status) ? response.status : 503,
        response.status === 401
          ? 'UNAUTHENTICATED'
          : response.status === 403
            ? 'FORBIDDEN'
            : response.status === 429
              ? 'RATE_LIMITED'
              : 'UNAVAILABLE',
      );
    const reader = response.body?.getReader();
    if (!reader) return error(503, 'UNAVAILABLE');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 128 * 1024) return error(503, 'INVALID_RESPONSE');
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new Response(bytes, {
      headers: {
        ...headers,
        'content-type': 'application/json; charset=utf-8',
      },
    });
  } catch {
    return error(503, 'UNAVAILABLE');
  }
}
