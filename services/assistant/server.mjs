import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const EXECUTIVE_PERMISSION = 'ui.screen.assistant.executive';
const TOOLS = Object.freeze([
  { id: 'calendar', path: '/workbench/calendar', key: 'data', limit: 1000 },
  { id: 'notes', path: '/workbench/notes', key: 'data', limit: 500 },
  {
    id: 'procurement',
    path: '/workbench/procurement-follow-ups',
    key: 'items',
    limit: 100,
  },
]);
const iso = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT/.test(value) &&
  Number.isFinite(Date.parse(value));
class ServiceError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

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
export function accessCookie(raw) {
  if (typeof raw !== 'string') return null;
  const matches = raw
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith('nora_access='));
  if (
    matches.length !== 1 ||
    !/^nora_access=[A-Za-z0-9_.%~-]{1,8192}$/.test(matches[0])
  )
    return null;
  return matches[0];
}
async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError(502, 'INVALID_SOURCE');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 512 * 1024) throw new ServiceError(502, 'SOURCE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export function personalFollowUps(tool, rows, now) {
  const cutoff = now.getTime() + 7 * 86400000;
  const result = [];
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== 'string' ||
      !row.id ||
      row.id.length > 100 ||
      typeof row.title !== 'string'
    )
      throw new ServiceError(502, 'INVALID_SOURCE');
    const due = tool === 'notes' ? row.reminderAt : row.dueAt;
    if (due != null && !iso(due)) throw new ServiceError(502, 'INVALID_SOURCE');
    if (tool === 'calendar' && ['COMPLETED', 'CANCELLED'].includes(row.status))
      continue;
    if (
      tool === 'notes' &&
      Array.isArray(row.items) &&
      row.items.length &&
      row.items.every((item) => item.done === true)
    )
      continue;
    if (tool !== 'procurement' && !due) continue;
    if (due && Date.parse(due) > cutoff) continue;
    if (
      tool === 'procurement' &&
      (typeof row.requestId !== 'string' || row.requestId.length > 100)
    )
      throw new ServiceError(502, 'INVALID_SOURCE');
    result.push({
      id: `${tool}:${row.id}`,
      title: row.title.slice(0, 200),
      source: tool,
      dueAt: due ? new Date(due).toISOString() : null,
      reason: !due
        ? 'ASSIGNED'
        : Date.parse(due) < now.getTime()
          ? 'OVERDUE'
          : 'DUE_SOON',
      href:
        tool === 'procurement'
          ? `/purchases?section=requests&request=${encodeURIComponent(row.requestId)}`
          : `/workbench?tab=${tool}`,
    });
  }
  return result;
}
export function createAssistantServer({
  erpBaseUrl,
  fetcher = fetch,
  audit = (event) => process.stdout.write(JSON.stringify(event) + '\n'),
  timeoutMs = 2500,
  now = () => new Date(),
}) {
  const base = configuredErpOrigin(erpBaseUrl);
  const windows = new Map();
  let inFlight = 0;
  function withinLimit(key, limit) {
    const time = Date.now();
    for (const [id, value] of windows)
      if (value.until <= time) windows.delete(id);
    const window = windows.get(key) ?? { count: 0, until: time + 60000 };
    if (!windows.has(key) && windows.size >= 2048) return false;
    windows.set(key, window);
    return ++window.count <= limit;
  }
  async function read(path, cookie, signal) {
    try {
      const response = await fetcher(base + path, {
        method: 'GET',
        headers: { accept: 'application/json', cookie },
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      });
      if ([401, 403].includes(response.status))
        throw new ServiceError(
          response.status,
          response.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
        );
      if (!response.ok) throw new ServiceError(502, 'SOURCE_UNAVAILABLE');
      return await boundedJson(response);
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(502, 'SOURCE_UNAVAILABLE');
    }
  }
  async function authenticate(cookie, signal, expectedUserId) {
    const actor = await read('/iam/auth/access', cookie, signal);
    if (
      !actor ||
      typeof actor.userId !== 'string' ||
      !actor.userId ||
      !Array.isArray(actor.permissions) ||
      !Array.isArray(actor.branchIds)
    )
      throw new ServiceError(502, 'INVALID_IDENTITY');
    // Public authenticated SELF access does not confer any corporate data grant.
    // Source APIs remain authoritative; the legacy executive grant is reserved.
    if (expectedUserId && actor.userId !== expectedUserId)
      throw new ServiceError(403, 'FORBIDDEN');
    return actor;
  }
  return createServer(
    { maxHeaderSize: 16384, requestTimeout: 12000, headersTimeout: 10000 },
    async (request, response) => {
      const correlationId = randomUUID();
      const started = Date.now();
      const deadline = new AbortController();
      const timer = setTimeout(() => deadline.abort(), 10000);
      response.once('close', () => {
        if (!response.writableEnded) deadline.abort();
      });
      let actorId;
      let counted = false;
      let outcome = 'FAILED';
      const toolOutcomes = [];
      const send = (status, body) => {
        response.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
          'x-request-id': correlationId,
          ...(status === 429 ? { 'retry-after': '60' } : {}),
        });
        response.end(JSON.stringify(body));
      };
      try {
        if (request.method !== 'GET') throw new ServiceError(405, 'READ_ONLY');
        if (request.url === '/health') {
          outcome = 'HEALTH';
          send(200, { status: 'ok' });
          return;
        }
        if (request.url !== '/v1/executive/snapshot')
          throw new ServiceError(404, 'NOT_FOUND');
        if (
          inFlight >= 8 ||
          !withinLimit(`ip:${request.socket.remoteAddress}`, 60)
        )
          throw new ServiceError(429, 'RATE_LIMITED');
        inFlight++;
        counted = true;
        const cookie = accessCookie(request.headers.cookie);
        if (!cookie) throw new ServiceError(401, 'UNAUTHENTICATED');
        const actor = await authenticate(cookie, deadline.signal);
        actorId = actor.userId;
        if (!withinLimit(`user:${actorId}`, 12))
          throw new ServiceError(429, 'RATE_LIMITED');
        const observedAt = now();
        const followUps = [];
        const sources = [];
        for (const tool of TOOLS) {
          await authenticate(cookie, deadline.signal, actorId);
          try {
            const body = await read(tool.path, cookie, deadline.signal);
            if (
              !body ||
              !Array.isArray(body[tool.key]) ||
              body[tool.key].length > tool.limit
            )
              throw new ServiceError(502, 'INVALID_SOURCE');
            followUps.push(
              ...personalFollowUps(tool.id, body[tool.key], observedAt),
            );
            sources.push({
              id: tool.id,
              status: 'READY',
              asOf: now().toISOString(),
              truncated: body[tool.key].length === tool.limit,
            });
            toolOutcomes.push({ tool: tool.id, outcome: 'SUCCESS' });
          } catch (error) {
            if (
              error instanceof ServiceError &&
              [401, 403].includes(error.status)
            )
              throw error;
            sources.push({
              id: tool.id,
              status: 'UNAVAILABLE',
              asOf: null,
              truncated: false,
            });
            toolOutcomes.push({ tool: tool.id, outcome: 'FAILED' });
          }
        }
        await authenticate(cookie, deadline.signal, actorId);
        const unique = [
          ...new Map(followUps.map((item) => [item.id, item])).values(),
        ].sort(
          (a, b) =>
            (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') ||
            a.id.localeCompare(b.id),
        );
        outcome = sources.every((item) => item.status === 'READY')
          ? 'SUCCESS'
          : 'PARTIAL';
        send(200, {
          version: 1,
          generatedAt: now().toISOString(),
          scope: 'SELF',
          sources,
          followUps: unique.slice(0, 30),
          truncated:
            unique.length > 30 || sources.some((source) => source.truncated),
          capabilities: {
            forecasting: false,
            news: false,
            scenarios: false,
            llm: false,
            writes: false,
          },
        });
      } catch (error) {
        const status = error instanceof ServiceError ? error.status : 503;
        outcome = status === 401 || status === 403 ? 'DENIED' : 'FAILED';
        send(status, {
          error: {
            code: error instanceof ServiceError ? error.message : 'UNAVAILABLE',
            correlationId,
          },
        });
      } finally {
        clearTimeout(timer);
        if (counted) inFlight--;
        // No cookie, raw URL, title, prompt, body or financial data in audit.
        try {
          audit({
            event: 'assistant.executive.read',
            correlationId,
            ...(actorId ? { actorId } : {}),
            at: now().toISOString(),
            outcome,
            tools: toolOutcomes,
            durationMs: Date.now() - started,
          });
        } catch {
          /* Deployment owns the retained audit sink. */
        }
      }
    },
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const service = createAssistantServer({
    erpBaseUrl: process.env.ERP_API_BASE_URL,
  });
  const port = Number(process.env.ASSISTANT_PORT ?? 4300);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid ASSISTANT_PORT');
  service.listen(port, '127.0.0.1', () =>
    process.stdout.write(`Assistant listening on loopback:${port}\n`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => service.close());
}
