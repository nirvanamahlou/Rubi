import { comparePersonal } from './recommendations.mjs';
import { blockedAction, dailySummary } from './actions.mjs';
import { getTool, PERSONAL_TOOLS } from './tools.mjs';
import { isToolAllowed, requireToolAccess } from './authorization.mjs';
import { ServiceError } from './errors.mjs';

/** Trusted composition shared by fixed actions and gated conversation. */
export async function runPreparedAction({
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
}) {
  let outcome;
  const send = (_status, body) => ({ outcome, body });
  if (action === 'sales-analysis' || action === 'receivables-follow-up') {
    const balances = action === 'receivables-follow-up';
    const tool = balances ? 'sales.contract-balances' : 'sales.weekly';
    const validate = getTool(actualTool(tool)).validate;
    const allowed = (principal) => isToolAllowed(principal, tool);
    requireToolAccess(actor, tool);
    let report;
    let conversion;
    let failure = 'SOURCE_UNAVAILABLE';
    try {
      report = await runTool(tool, cookie);
    } catch (error) {
      if (error instanceof ServiceError && [401, 403].includes(error.status))
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
    const afterSales = await authenticate(cookie, deadline.signal, actorId);
    if (!allowed(afterSales)) throw new ServiceError(403, 'FORBIDDEN');
    if (!balances && report) {
      conversion = { status: 'DENIED' };
      if (
        filteredRequest &&
        (reportInput.originId || reportInput.destinationId)
      ) {
        conversion = {
          status: 'UNAVAILABLE',
          reason: 'ROUTE_COHORT_SOURCE_PENDING',
        };
      } else if (
        afterSales.permissions.includes('customer_affairs.lead.read')
      ) {
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
        const finalActor = await authenticate(cookie, deadline.signal, actorId);
        if (
          !allowed(finalActor) ||
          !finalActor.permissions.includes('customer_affairs.lead.read')
        )
          throw new ServiceError(403, 'FORBIDDEN');
      }
    }
    outcome = report && validate(report) ? 'PARTIAL' : 'BLOCKED';
    return send(
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
      if (error instanceof ServiceError && [401, 403].includes(error.status))
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
  for (const source of sources.filter((source) => source.status === 'READY'))
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
    const releaseActor = await authenticate(cookie, deadline.signal, actorId);
    for (const source of sources.filter((source) => source.status === 'READY'))
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
    truncated: unique.length > 30 || sources.some((source) => source.truncated),
    capabilities: {
      forecasting: false,
      news: false,
      scenarios: false,
      llm: false,
      writes: false,
    },
  };
  return send(
    200,
    action === 'daily-summary'
      ? { ...dailySummary(snapshot), corporate }
      : snapshot,
  );
}
