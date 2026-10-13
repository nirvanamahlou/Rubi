import { comparePersonal } from './recommendations.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { actionFromPath, blockedAction, dailySummary } from './actions.mjs';
import { getTool, PERSONAL_TOOLS } from './tools.mjs';
import { ServiceError } from './errors.mjs';
import { createErpClient } from './erp-client.mjs';
import {
  accessCookie,
  createAuthorization,
  isToolAllowed,
  requireToolAccess,
} from './authorization.mjs';
import { createToolExecutor } from './tool-executor.mjs';
import { recordRequestAudit } from './audit.mjs';
export { accessCookie } from './authorization.mjs';
export { configuredErpOrigin } from './erp-client.mjs';
export { personalFollowUps } from './personal-source.mjs';
export const EXECUTIVE_PERMISSION = 'ui.screen.assistant.executive';
export function createAssistantServer({
  erpBaseUrl,
  erpReportsBaseUrl = erpBaseUrl,
  erpAuthBaseUrl = erpBaseUrl,
  fetcher = fetch,
  audit = (event) => process.stdout.write(JSON.stringify(event) + '\n'),
  timeoutMs = 2500,
  now = () => new Date(),
}) {
  const client = createErpClient({
    erpBaseUrl,
    erpReportsBaseUrl,
    erpAuthBaseUrl,
    fetcher,
    timeoutMs,
  });
  const authenticate = createAuthorization(client);
  const execute = createToolExecutor({ client, authenticate, now });
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
      const runTool = (id, cookie, observedAt) =>
        execute(
          id,
          {},
          {
            cookie,
            signal: deadline.signal,
            actorId,
            observedAt,
            record: (entry) => toolOutcomes.push(entry),
          },
        );
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
          const tool = balances ? 'sales.contract-balances' : 'sales.weekly';
          const validate = getTool(tool).validate;
          const allowed = (principal) => isToolAllowed(principal, tool);
          requireToolAccess(actor, tool);
          let report;
          let conversion;
          let failure = 'SOURCE_UNAVAILABLE';
          try {
            report = await runTool(tool, cookie);
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
                const value = await runTool(
                  'customer-affairs.call-conversion',
                  cookie,
                );
                if (
                  value.current.startUtc !== report.current.startUtc ||
                  value.current.endUtc !== report.current.endUtc
                )
                  throw new ServiceError(502, 'INVALID_SOURCE');
                conversion = { status: 'READY', report: value };
              } catch (error) {
                if (
                  error instanceof ServiceError &&
                  [401, 403].includes(error.status)
                )
                  throw error;
                conversion = { status: 'UNAVAILABLE' };
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
        for (const tool of PERSONAL_TOOLS) {
          try {
            const result = await runTool(tool.id, cookie, observedAt);
            followUps.push(...result.followUps);
            sources.push({
              id: tool.id,
              status: 'READY',
              asOf: now().toISOString(),
              truncated: result.truncated,
            });
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
            { key: 'sales', id: 'sales.weekly' },
            { key: 'balances', id: 'sales.contract-balances' },
          ];
          await Promise.all(
            definitions.map(async (definition) => {
              if (!isToolAllowed(finalPersonalActor, definition.id)) return;
              try {
                corporate[definition.key] = {
                  status: 'READY',
                  report: await runTool(definition.id, cookie),
                };
              } catch (error) {
                if (
                  error instanceof ServiceError &&
                  [401, 403].includes(error.status)
                )
                  throw error;
                corporate[definition.key] = { status: 'UNAVAILABLE' };
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
                !isToolAllowed(releaseActor, definition.id),
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
        recordRequestAudit(audit, {
          action,
          correlationId,
          actorId,
          at: now().toISOString(),
          outcome,
          tools: toolOutcomes,
          durationMs: Date.now() - started,
        });
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
