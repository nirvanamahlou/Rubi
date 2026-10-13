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
  return proxyRead(request, configuredUrl, '/v1/executive/snapshot', fetcher);
}

const actionNames = [
  'daily-summary',
  'sales-analysis',
  'receivables-follow-up',
];
export async function proxyAssistantV2Action(
  request: Request,
  configuredUrl: string | undefined,
  action: string,
  fetcher: typeof fetch = fetch,
) {
  if (!actionNames.includes(action))
    return Response.json(
      { error: { code: 'NOT_FOUND' } },
      { status: 404, headers: { 'cache-control': 'private, no-store' } },
    );
  return proxyRead(
    request,
    configuredUrl,
    `/v2/assistant/actions/${action}`,
    fetcher,
    true,
  );
}
export async function proxyAssistantFilterOptions(
  request: Request,
  configuredUrl: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  return proxyRead(
    request,
    configuredUrl,
    '/v2/assistant/filter-options',
    fetcher,
  );
}
export async function proxyAssistantAction(
  request: Request,
  configuredUrl: string | undefined,
  action: string,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (!actionNames.includes(action))
    return Response.json(
      { error: { code: 'NOT_FOUND' } },
      { status: 404, headers: { 'cache-control': 'private, no-store' } },
    );
  return proxyRead(
    request,
    configuredUrl,
    `/v1/assistant/actions/${action}`,
    fetcher,
  );
}

async function proxyRead(
  request: Request,
  configuredUrl: string | undefined,
  path: string,
  fetcher: typeof fetch,
  filtered = false,
): Promise<Response> {
  const headers: Record<string, string> = {
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
  };
  const error = (status: number, code: string) =>
    Response.json({ error: { code } }, { status, headers });
  const cookie = tokenCookie(request.headers.get('cookie'));
  if (!cookie) return error(401, 'UNAUTHENTICATED');
  if (request.method !== 'GET') return error(405, 'READ_ONLY');
  const query = new URL(request.url).searchParams;
  if (filtered) {
    const allowed = [
      'startDate',
      'endDate',
      'originId',
      'destinationId',
      'branchId',
    ];
    if (
      [...query.keys()].some(
        (key) => !allowed.includes(key) || query.getAll(key).length !== 1,
      ) ||
      [...query.values()].some((value) => value.length > 40)
    )
      return error(400, 'INVALID_REQUEST');
  } else if (query.size) return error(400, 'INVALID_REQUEST');
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
    target.pathname = path;
    if (filtered) target.search = query.toString();
    const response = await fetcher(target, {
      method: 'GET',
      headers: { accept: 'application/json', cookie },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
    });
    const correlation = response.headers.get('x-request-id');
    if (
      correlation &&
      /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(correlation)
    )
      headers['x-request-id'] = correlation;
    if (!response.ok)
      return error(
        [400, 401, 403, 429].includes(response.status) ? response.status : 503,
        response.status === 400
          ? 'INVALID_REQUEST'
          : response.status === 401
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
