import { createOrchestrator, readMessage } from './orchestrator.mjs';
import { parseFilterSearch, resolveReportFilters } from './report-filters.mjs';
import { runPreparedAction } from './prepared-actions.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { actionFromPath } from './actions.mjs';
import { getTool } from './tools.mjs';
import { ServiceError } from './errors.mjs';
import { createErpClient } from './erp-client.mjs';
import {
  accessCookie,
  createAuthorization,
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
  conversation,
}) {
  const client = createErpClient({
    erpBaseUrl,
    erpReportsBaseUrl,
    erpAuthBaseUrl,
    fetcher,
    timeoutMs,
  });
  const authenticateErp = createAuthorization(client);
  const execute = createToolExecutor({
    client,
    authenticate: authenticateErp,
    now,
  });
  const orchestrate = createOrchestrator({ ...conversation, now });
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
      const conversationRequest = request.url === '/v2/assistant/conversation';
      let actorId;
      let action;
      let optionsRequest = false;
      let filteredRequest = false;
      let reportInput = {};
      const authenticate = async (...args) => {
        const actor = await authenticateErp(...args);
        if (
          reportInput.branchId &&
          !actor.branchIds.includes(reportInput.branchId)
        )
          throw new ServiceError(403, 'FORBIDDEN');
        return actor;
      };
      const actualTool = (id) =>
        filteredRequest
          ? ({
              'sales.weekly': 'sales.report.v2',
              'sales.contract-balances': 'sales.contract-balances.v2',
              'customer-affairs.call-conversion':
                'customer-affairs.call-conversion.v2',
            }[id] ?? id)
          : id;
      let counted = false;
      let outcome = 'FAILED';
      const toolOutcomes = [];
      let toolCalls = 0;
      const runTool = (id, cookie, observedAt) => {
        if (++toolCalls > 6)
          throw new ServiceError(429, 'TOOL_BUDGET_EXCEEDED');
        return execute(
          actualTool(id),
          getTool(actualTool(id)).filtered ? reportInput : {},
          {
            cookie,
            signal: deadline.signal,
            actorId,
            observedAt,
            record: (entry) => toolOutcomes.push(entry),
          },
        );
      };
      const send = (status, body) => {
        response.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'private, no-store',
          'x-content-type-options': 'nosniff',
          'x-request-id': correlationId,
          ...(status === 429 ? { 'retry-after': '60' } : {}),
        });
        response.end(
          JSON.stringify(
            filteredRequest && !conversationRequest && status === 200
              ? {
                  ...body,
                  version: 2,
                  filters: resolveReportFilters(reportInput, now()),
                }
              : body,
          ),
        );
      };
      try {
        if (
          conversationRequest
            ? request.method !== 'POST'
            : request.method !== 'GET'
        )
          throw new ServiceError(405, 'READ_ONLY');
        if (request.url === '/health') {
          outcome = 'HEALTH';
          send(200, { status: 'ok' });
          return;
        }
        if (request.url.startsWith('/v2/assistant/actions/')) {
          const url = new URL(request.url, 'http://localhost');
          action = actionFromPath('/v1' + url.pathname.slice(3));
          if (!action) throw new ServiceError(404, 'NOT_FOUND');
          reportInput = parseFilterSearch(url.search, now());
          filteredRequest = true;
        } else action = actionFromPath(request.url);
        optionsRequest = request.url === '/v2/assistant/filter-options';
        if (
          request.url !== '/v1/executive/snapshot' &&
          !action &&
          !optionsRequest &&
          !conversationRequest
        )
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
        if (conversationRequest) {
          const message = await readMessage(request, deadline.signal);
          const result = await orchestrate(message, {
            signal: deadline.signal,
            runAction: async (selected, filters) => {
              action = selected;
              filteredRequest = true;
              reportInput = filters;
              await authenticate(cookie, deadline.signal, actorId);
              const result = await runPreparedAction({
                action,
                runTool,
                authenticate,
                cookie,
                actor,
                actorId,
                deadline,
                now,
                actualTool,
                filteredRequest,
                reportInput,
              });
              outcome = result.outcome;
              return {
                ...result.body,
                version: 2,
                filters: resolveReportFilters(reportInput, now()),
              };
            },
          });
          const releaseActor = await authenticate(
            cookie,
            deadline.signal,
            actorId,
          );
          if (result.status === 'ANSWER') {
            if (
              actor.branchIds.some((id) => !releaseActor.branchIds.includes(id))
            )
              throw new ServiceError(403, 'FORBIDDEN');
            for (const entry of toolOutcomes.filter(
              (entry) => entry.outcome === 'SUCCESS',
            )) {
              requireToolAccess(releaseActor, entry.tool);
              if (getTool(entry.tool).scope === 'SELF')
                await authenticate(
                  cookie,
                  deadline.signal,
                  actorId,
                  entry.tool,
                );
            }
          }
          if (result.status === 'CLARIFY') outcome = 'SUCCESS';
          send(200, result);
          return;
        }
        if (optionsRequest) {
          const options = await runTool('sales.filter-options', cookie);
          outcome = 'SUCCESS';
          send(200, options);
          return;
        }
        const result = await runPreparedAction({
          action,
          runTool,
          authenticate,
          cookie,
          actor,
          actorId,
          deadline,
          now,
          actualTool,
          filteredRequest,
          reportInput,
        });
        outcome = result.outcome;
        send(200, result.body);
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
          conversation: conversationRequest,
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
