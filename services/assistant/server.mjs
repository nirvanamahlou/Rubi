import { tehranDay, comparePersonal } from './recommendations.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { actionFromPath, blockedAction, dailySummary } from './actions.mjs';
import { validSalesSource, projectSalesSource } from './sales-source.mjs';
import {
  validBalanceSource,
  projectBalanceSource,
} from './balances-source.mjs';
import {
  validConversionSource,
  projectConversionSource,
} from './conversion-source.mjs';

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
  const cutoff = tehranDay(now) + 7;
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
    if (due && tehranDay(due) > cutoff) continue;
    if (
      tool === 'procurement' &&
      (typeof row.requestId !== 'string' || row.requestId.length > 100)
    )
      throw new ServiceError(502, 'INVALID_SOURCE');
    result.push({
      id: `${tool}:${row.id}`,
      title: row.title.slice(0, 200),
      source: tool,
      sourcePriority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(row.priority)
        ? row.priority
        : 'NORMAL',
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
  erpReportsBaseUrl = erpBaseUrl,
  erpAuthBaseUrl = erpBaseUrl,
  fetcher = fetch,
  audit = (event) => process.stdout.write(JSON.stringify(event) + '\n'),
  timeoutMs = 2500,
  now = () => new Date(),
}) {
  const base = configuredErpOrigin(erpBaseUrl);
  const reportBase = configuredErpOrigin(erpReportsBaseUrl);
  const authBase = configuredErpOrigin(erpAuthBaseUrl);
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
  async function read(path, cookie, signal, source) {
    try {
      const isReport = [
        '/sales/assistant/weekly',
        '/sales/assistant/contract-balances',
        '/customer-affairs/assistant/call-conversion',
      ].includes(path);
      const response = await fetcher(
        (path === '/iam/auth/access'
          ? authBase
          : isReport
            ? reportBase
            : base) + path,
        {
          method: 'GET',
          headers: {
            accept: 'application/json',
            cookie,
            ...(source ? { 'x-assistant-source': source } : {}),
          },
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
        },
      );
      if ([401, 403].includes(response.status))
        throw new ServiceError(
          response.status,
          response.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN',
        );
      if (response.status === 404)
        throw new ServiceError(502, 'SOURCE_NOT_CONNECTED');
      if (response.status === 409) {
        const body = await boundedJson(response);
        throw new ServiceError(
          502,
          body?.message === 'SALES_SOURCE_CAP_EXCEEDED'
            ? 'SOURCE_CAP_EXCEEDED'
            : 'SOURCE_NOT_READY',
        );
      }
      if (!response.ok) throw new ServiceError(502, 'SOURCE_UNAVAILABLE');
      return await boundedJson(response);
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
  async function authenticate(cookie, signal, expectedUserId, source) {
    const actor = await read('/iam/auth/access', cookie, signal, source);
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
      let action;
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
        action = actionFromPath(request.url);
        if (request.url !== '/v1/executive/snapshot' && !action)
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
        if (action === 'sales-analysis' || action === 'receivables-follow-up') {
          const balances = action === 'receivables-follow-up';
          const allowed = (principal) =>
            principal.permissions.includes('sales.contracts.read.all') &&
            (!balances ||
              principal.permissions.includes('sales.payments.read'));
          const validate = balances ? validBalanceSource : validSalesSource;
          const project = balances ? projectBalanceSource : projectSalesSource;
          const tool = balances ? 'sales.contract-balances' : 'sales.weekly';
          if (!allowed(actor)) throw new ServiceError(403, 'FORBIDDEN');
          const beforeSales = await authenticate(
            cookie,
            deadline.signal,
            actorId,
          );
          if (!allowed(beforeSales)) throw new ServiceError(403, 'FORBIDDEN');
          let report;
          let conversion;
          let failure = 'SOURCE_UNAVAILABLE';
          try {
            report = await read(
              balances
                ? '/sales/assistant/contract-balances'
                : '/sales/assistant/weekly',
              cookie,
              deadline.signal,
            );
            if (!validate(report))
              throw new ServiceError(502, 'INVALID_SOURCE');
            report = project(report);
            toolOutcomes.push({ tool, outcome: 'SUCCESS' });
          } catch (error) {
            if (
              error instanceof ServiceError &&
              [401, 403].includes(error.status)
            )
              throw error;
            if (
              error instanceof ServiceError &&
              [
                'SOURCE_NOT_CONNECTED',
                'SOURCE_NOT_READY',
                'SOURCE_CAP_EXCEEDED',
                'SOURCE_TOO_LARGE',
                'INVALID_SOURCE',
                'SOURCE_TIMEOUT',
                'SOURCE_UNAVAILABLE',
              ].includes(error.message)
            )
              failure = error.message;
            toolOutcomes.push({ tool, outcome: 'FAILED' });
          }
          const afterSales = await authenticate(
            cookie,
            deadline.signal,
            actorId,
          );
          if (!allowed(afterSales)) throw new ServiceError(403, 'FORBIDDEN');
          if (!balances && report) {
            conversion = { status: 'DENIED' };
            if (afterSales.permissions.includes('customer_affairs.lead.read')) {
              try {
                const value = await read(
                  '/customer-affairs/assistant/call-conversion',
                  cookie,
                  deadline.signal,
                );
                if (
                  !validConversionSource(value) ||
                  value.current.startUtc !== report.current.startUtc ||
                  value.current.endUtc !== report.current.endUtc
                )
                  throw new ServiceError(502, 'INVALID_SOURCE');
                conversion = {
                  status: 'READY',
                  report: projectConversionSource(value),
                };
                toolOutcomes.push({
                  tool: 'customer-affairs.call-conversion',
                  outcome: 'SUCCESS',
                });
              } catch (error) {
                if (
                  error instanceof ServiceError &&
                  [401, 403].includes(error.status)
                )
                  throw error;
                conversion = { status: 'UNAVAILABLE' };
                toolOutcomes.push({
                  tool: 'customer-affairs.call-conversion',
                  outcome: 'FAILED',
                });
              }
              const finalActor = await authenticate(
                cookie,
                deadline.signal,
                actorId,
              );
              if (
                !allowed(finalActor) ||
                !finalActor.permissions.includes('customer_affairs.lead.read')
              )
                throw new ServiceError(403, 'FORBIDDEN');
            }
          }
          outcome = report && validate(report) ? 'PARTIAL' : 'BLOCKED';
          send(
            200,
            outcome === 'PARTIAL'
              ? {
                  version: 1,
                  action,
                  status: 'PARTIAL',
                  scope: 'ALL_AUTHORIZED_SALES',
                  report,
                  ...(!balances ? { conversion } : {}),
                }
              : { ...blockedAction(action, now().toISOString()), failure },
          );
          return;
        }
        const observedAt = now();
        const followUps = [];
        const sources = [];
        for (const tool of TOOLS) {
          await authenticate(cookie, deadline.signal, actorId, tool.id);
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
        const finalPersonalActor = await authenticate(
          cookie,
          deadline.signal,
          actorId,
        );
        for (const source of sources.filter(
          (source) => source.status === 'READY',
        ))
          await authenticate(cookie, deadline.signal, actorId, source.id);
        let corporate;
        if (action === 'daily-summary') {
          corporate = {
            sales: { status: 'DENIED' },
            balances: { status: 'DENIED' },
          };
          const definitions = [
            {
              key: 'sales',
              path: '/sales/assistant/weekly',
              permission: ['sales.contracts.read.all'],
              valid: validSalesSource,
              project: projectSalesSource,
            },
            {
              key: 'balances',
              path: '/sales/assistant/contract-balances',
              permission: ['sales.contracts.read.all', 'sales.payments.read'],
              valid: validBalanceSource,
              project: projectBalanceSource,
            },
          ];
          await Promise.all(
            definitions.map(async (definition) => {
              if (
                !definition.permission.every((permission) =>
                  finalPersonalActor.permissions.includes(permission),
                )
              )
                return;
              try {
                const value = await read(
                  definition.path,
                  cookie,
                  deadline.signal,
                );
                if (!definition.valid(value))
                  throw new ServiceError(502, 'INVALID_SOURCE');
                corporate[definition.key] = {
                  status: 'READY',
                  report: definition.project(value),
                };
                toolOutcomes.push({ tool: definition.key, outcome: 'SUCCESS' });
              } catch (error) {
                if (
                  error instanceof ServiceError &&
                  [401, 403].includes(error.status)
                )
                  throw error;
                corporate[definition.key] = { status: 'UNAVAILABLE' };
                toolOutcomes.push({ tool: definition.key, outcome: 'FAILED' });
              }
            }),
          );
          const releaseActor = await authenticate(
            cookie,
            deadline.signal,
            actorId,
          );
          for (const source of sources.filter(
            (source) => source.status === 'READY',
          ))
            await authenticate(cookie, deadline.signal, actorId, source.id);
          if (
            definitions.some(
              (definition) =>
                corporate[definition.key].status === 'READY' &&
                !definition.permission.every((permission) =>
                  releaseActor.permissions.includes(permission),
                ),
            )
          )
            throw new ServiceError(403, 'FORBIDDEN');
        }
        const evaluatedAt = now();
        const unique = [
          ...new Map(followUps.map((item) => [item.id, item])).values(),
        ].sort((a, b) => comparePersonal(a, b, evaluatedAt));
        outcome = sources.every((item) => item.status === 'READY')
          ? 'SUCCESS'
          : 'PARTIAL';
        const snapshot = {
          version: 1,
          generatedAt: evaluatedAt.toISOString(),
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
        };
        send(
          200,
          action === 'daily-summary'
            ? { ...dailySummary(snapshot), corporate }
            : snapshot,
        );
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
            event: action
              ? 'assistant.action.read'
              : 'assistant.executive.read',
            ...(action ? { action } : {}),
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
    erpAuthBaseUrl:
      process.env.ERP_AUTH_API_BASE_URL ??
      process.env.ERP_REPORTS_API_BASE_URL ??
      process.env.ERP_API_BASE_URL,
    erpReportsBaseUrl:
      process.env.ERP_REPORTS_API_BASE_URL ?? process.env.ERP_API_BASE_URL,
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
