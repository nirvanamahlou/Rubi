import { ServiceError } from './errors.mjs';
import { filterQuery, resolveReportFilters } from './report-filters.mjs';

export const CONVERSATION_ACTIONS = Object.freeze([
  'daily-summary',
  'sales-analysis',
  'receivables-follow-up',
]);
const fields = new Set([
  'ACTION',
  'DATE_RANGE',
  'ROUTE',
  'BRANCH',
  'COMPANY_UNAVAILABLE',
]);
function shape(value, keys) {
  return (
    value &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
export function validateMessage(value) {
  if (
    !shape(value, ['version', 'message', 'history']) ||
    value.version !== 1 ||
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    value.message.length > 4000 ||
    !Array.isArray(value.history) ||
    value.history.length > 12 ||
    value.history.some(
      (item) =>
        !shape(item, ['role', 'content']) ||
        !['user', 'assistant'].includes(item.role) ||
        typeof item.content !== 'string' ||
        item.content.length > 2000,
    ) ||
    value.history.reduce(
      (n, item) => n + item.content.length,
      value.message.length,
    ) > 16000
  )
    throw new ServiceError(400, 'INVALID_MESSAGE');
  return {
    version: 1,
    message: value.message,
    history: value.history.map(({ role, content }) => ({ role, content })),
  };
}
export async function readMessage(request, signal) {
  if (
    request.headers['content-type']?.split(';')[0].trim() !== 'application/json'
  )
    throw new ServiceError(415, 'JSON_REQUIRED');
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    const done = (error, value) => {
      request.off('data', data);
      request.off('end', end);
      request.off('error', errorHandler);
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(value);
    };
    const data = (chunk) => {
      bytes += chunk.length;
      if (bytes > 65536) {
        request.resume();
        done(new ServiceError(413, 'MESSAGE_TOO_LARGE'));
      } else chunks.push(chunk);
    };
    const end = () => {
      try {
        done(
          null,
          validateMessage(JSON.parse(Buffer.concat(chunks).toString('utf8'))),
        );
      } catch {
        done(new ServiceError(400, 'INVALID_MESSAGE'));
      }
    };
    const errorHandler = () => done(new ServiceError(400, 'INVALID_MESSAGE'));
    const abort = () => done(new ServiceError(503, 'CONVERSATION_TIMEOUT'));
    request.on('data', data);
    request.once('end', end);
    request.once('error', errorHandler);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
/** Provider plans remain untrusted; only fixed read actions can execute. */
export function createOrchestrator({
  provider,
  enabled = false,
  timeoutMs = 1500,
  now = () => new Date(),
} = {}) {
  return async function orchestrate(input, { signal, runAction }) {
    if (!enabled || typeof provider?.plan !== 'function')
      throw new ServiceError(503, 'CONVERSATION_DISABLED');
    const message = validateMessage(input);
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    let rejectDeadline;
    const deadline = new Promise((_, reject) => {
      rejectDeadline = reject;
    });
    const abort = () =>
      rejectDeadline(new ServiceError(503, 'CONVERSATION_TIMEOUT'));
    combined.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(6000, Math.max(1, timeoutMs)),
    );
    try {
      if (combined.aborted) throw new ServiceError(503, 'CONVERSATION_TIMEOUT');
      // Only untrusted message/history and fixed capability names: no cookie, identity, grants or source records.
      const plan = await Promise.race([
        Promise.resolve().then(() =>
          provider.plan(
            { ...message, actions: CONVERSATION_ACTIONS },
            { signal: combined, maxOutputTokens: 512 },
          ),
        ),
        deadline,
      ]);
      if (Buffer.byteLength(JSON.stringify(plan) ?? '') > 8192)
        throw new ServiceError(502, 'INVALID_PLAN');
      if (
        shape(plan, ['kind', 'text']) &&
        plan.kind === 'REPLY' &&
        typeof plan.text === 'string' &&
        plan.text.trim() &&
        plan.text.length <= 2000
      ) {
        return { version: 1, status: 'REPLY', text: plan.text.trim() };
      }
      if (
        shape(plan, ['kind', 'field']) &&
        plan.kind === 'CLARIFY' &&
        fields.has(plan.field)
      )
        return { version: 1, status: 'CLARIFY', field: plan.field };
      if (
        !shape(plan, ['kind', 'action', 'filters']) ||
        plan.kind !== 'ACTION' ||
        !CONVERSATION_ACTIONS.includes(plan.action)
      )
        throw new ServiceError(502, 'INVALID_PLAN');
      let filters;
      try {
        filters = filterQuery(resolveReportFilters(plan.filters ?? {}, now()));
      } catch {
        throw new ServiceError(502, 'INVALID_PLAN');
      }
      if (combined.aborted) throw new ServiceError(503, 'CONVERSATION_TIMEOUT');
      clearTimeout(timer); // ERP execution uses the enclosing request deadline and bounded tool executor.
      const evidence = await runAction(plan.action, filters);
      return { version: 1, status: 'ANSWER', action: plan.action, evidence };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(503, 'CONVERSATION_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      combined.removeEventListener('abort', abort);
    }
  };
}
