import { ServiceError } from './errors.mjs';
import { getTool, PERSONAL_TOOLS } from './tools.mjs';
export function configuredErpOrigin(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
  )
    throw new Error(
      'ERP_API_BASE_URL must use HTTPS or loopback HTTP with no credentials/query.',
    );
  return url.toString().replace(/\/$/, '');
}
async function boundedJson(response, maxResponseBytes) {
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError(502, 'INVALID_SOURCE');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxResponseBytes)
        throw new ServiceError(502, 'SOURCE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export function createErpClient({
  erpBaseUrl,
  erpReportsBaseUrl = erpBaseUrl,
  erpAuthBaseUrl = erpBaseUrl,
  fetcher = fetch,
  timeoutMs = 2500,
}) {
  const base = configuredErpOrigin(erpBaseUrl);
  const reportBase = configuredErpOrigin(erpReportsBaseUrl);
  const authBase = configuredErpOrigin(erpAuthBaseUrl);
  async function read(
    path,
    baseUrl,
    cookie,
    signal,
    source,
    maxResponseBytes = 512 * 1024,
  ) {
    try {
      const response = await fetcher(baseUrl + path, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          cookie,
          ...(source ? { 'x-assistant-source': source } : {}),
        },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      if ([401, 403].includes(response.status))
        throw new ServiceError(
          response.status,
          response.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
        );
      if (response.status === 404)
        throw new ServiceError(502, 'SOURCE_NOT_CONNECTED');
      if (response.status === 409) {
        const body = await boundedJson(response, maxResponseBytes);
        throw new ServiceError(
          502,
          body?.message === 'SALES_SOURCE_CAP_EXCEEDED'
            ? 'SOURCE_CAP_EXCEEDED'
            : 'SOURCE_NOT_READY',
        );
      }
      if (!response.ok) throw new ServiceError(502, 'SOURCE_UNAVAILABLE');
      return await boundedJson(response, maxResponseBytes);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        502,
        error?.name === 'TimeoutError' || signal.aborted
          ? 'SOURCE_TIMEOUT'
          : 'SOURCE_UNAVAILABLE',
      );
    }
  }
  return Object.freeze({
    identity(cookie, signal, source) {
      if (
        source !== undefined &&
        !PERSONAL_TOOLS.some((tool) => tool.id === source)
      )
        throw new ServiceError(400, 'INVALID_TOOL_INPUT');
      return read('/iam/auth/access', authBase, cookie, signal, source);
    },
    readTool(id, cookie, signal) {
      const tool = getTool(id);
      return read(
        tool.path,
        tool.base === 'reports' ? reportBase : base,
        cookie,
        signal,
        undefined,
        tool.limits.maxResponseBytes,
      );
    },
  });
}
