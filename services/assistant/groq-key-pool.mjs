import { ServiceError } from './errors.mjs';
import { createHash } from 'node:crypto';
import { validateGroqCredentials } from './groq-credentials.mjs';

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const state = () => ({ until: 0, epoch: 0, probe: false, denied: false });
const cancelled = (signal) => {
  if (signal?.aborted) throw new Error('GROQ_REQUEST_ABORTED');
};
function block(s, until, denied = false) {
  s.until = Math.max(s.until, until);
  s.denied ||= denied;
  s.epoch++;
  s.probe = false;
}
function duration(v) {
  if (!v || v.length > 80) return NaN;
  const match =
    /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/.exec(
      v,
    );
  return match && match.slice(1).some(Boolean)
    ? Number(match[1] ?? 0) * 3600000 +
        Number(match[2] ?? 0) * 60000 +
        Number(match[3] ?? 0) * 1000 +
        Number(match[4] ?? 0)
    : NaN;
}
export function groqRetryDelay(headers, now) {
  const header = headers.get('retry-after');
  const retry =
    header && /^\d+(?:\.\d+)?$/.test(header)
      ? Number(header) * 1000
      : header
        ? Date.parse(header) - now
        : NaN;
  const resets = ['requests', 'tokens']
    .filter((k) => headers.get('x-ratelimit-remaining-' + k) === '0')
    .map((k) => duration(headers.get('x-ratelimit-reset-' + k)));
  const valid = [retry, ...resets].filter(
    (v) => Number.isFinite(v) && v > 0 && Number.isSafeInteger(Math.ceil(v)),
  );
  return valid.length ? Math.max(...valid) : 60000;
}
async function errorBody(response) {
  const reader = response.body?.getReader();
  if (!reader) return { bytes: null, error: {} };
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) return { bytes: null, error: {} };
      chunks.push(Buffer.from(value));
    }
    const bytes = Buffer.concat(chunks);
    let value;
    try {
      value = JSON.parse(bytes.toString('utf8'));
    } catch {
      /* untrusted/non-JSON response */
    }
    return {
      bytes,
      error: value?.error && typeof value.error === 'object' ? value.error : {},
    };
  } catch {
    throw new Error('GROQ_TRANSPORT_UNAVAILABLE');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function failureScope(error) {
  const scope = error.scope ?? error.rate_limit_scope;
  const code = typeof error.code === 'string' ? error.code : '';
  const message =
    typeof error.message === 'string' ? error.message.slice(0, 16000) : '';
  // Structured scope outranks incidental organization wording in a message.
  if (scope === 'organization' || scope === 'org') return 'organization';
  if (scope === 'project' || scope === 'key') return scope;
  if (
    /^(?:organization|org)[_-](?:rate|quota|limit|permission)/.test(code) ||
    code === 'blocked_api_access'
  )
    return 'organization';
  if (/^project[_-](?:rate|quota|limit)/.test(code)) return 'project';
  if (
    /^(?:key_rate_limit_exceeded|api_key_rate_limit_exceeded|key_permission_denied|invalid_api_key)$/.test(
      code,
    )
  )
    return 'key';
  if (/\b(?:in|for)\s+(?:the\s+)?organization\b/i.test(message))
    return 'organization';
  return 'unknown';
}

function providerOrganization(error) {
  const raw = error.organization_id ?? error.organizationId;
  const message =
    typeof error.message === 'string' ? error.message.slice(0, 16000) : '';
  const identifier =
    typeof raw === 'string' && /^org_[A-Za-z0-9_-]{1,120}$/.test(raw)
      ? raw
      : message.match(
          /\borganization\s+[`"']?(org_[A-Za-z0-9_-]{1,120})\b/i,
        )?.[1];
  // Keep only equality evidence in memory, never the upstream identifier or message.
  return identifier
    ? 'provider-org:' + createHash('sha256').update(identifier).digest('hex')
    : undefined;
}
const quotaUnit = (error) =>
  typeof error.message === 'string'
    ? (error.message
        .slice(0, 16000)
        .match(/\b(TPM|TPD|RPM|RPD|ITPM|OTPM)\b/)?.[1] ?? 'unknown')
    : 'unknown';

/** Credentials and cooldown metadata only; never retain prompts, users or evidence. */
export function createGroqKeyPool({
  entries,
  fetcher = fetch,
  now = Date.now,
  audit = () => {},
}) {
  const keys = validateGroqCredentials({ version: 1, keys: entries }).map(
    (entry) => ({ ...entry, ...state(), disabled: entry.enabled === false }),
  );
  const groups = new Map();
  let cursor = 0;
  const group = (id) => {
    if (!groups.has(id)) groups.set(id, state());
    return groups.get(id);
  };
  const scopes = (key) => [
    group('org:' + key.organization),
    ...(key.providerOrganization ? [group(key.providerOrganization)] : []),
    ...(key.project
      ? [group('project:' + key.organization + ':' + key.project)]
      : []),
  ];
  const emit = (key, category, attempt, until = 0, limitUnit = null) => {
    try {
      audit(
        Object.freeze({
          event: 'assistant.groq.pool',
          keyId: key.id,
          category,
          attempt,
          limitUnit,
          availableAt:
            Number.isFinite(until) && until > 0
              ? new Date(until).toISOString()
              : null,
        }),
      );
    } catch {
      /* no sensitive fallback logging */
    }
  };
  function select(tried) {
    const time = now();
    for (let n = 0; n < keys.length; n++) {
      const index = (cursor + n) % keys.length,
        key = keys[index],
        shared = scopes(key);
      if (
        tried.has(index) ||
        key.disabled ||
        key.probe ||
        key.until > time ||
        shared.some((s) => s.denied || s.probe || s.until > time)
      )
        continue;
      const lease = {
        index,
        key,
        epoch: key.epoch,
        shared: shared.map((s) => ({
          s,
          epoch: s.epoch,
          probing: s.until > 0,
        })),
        probing: key.until > 0,
      };
      if (lease.probing) key.probe = true;
      for (const item of lease.shared) if (item.probing) item.s.probe = true;
      return lease;
    }
  }
  function release(lease, success = false) {
    const fresh =
      lease.key.epoch === lease.epoch &&
      lease.shared.every((x) => x.s.epoch === x.epoch);
    if (lease.probing && lease.key.epoch === lease.epoch)
      lease.key.probe = false;
    for (const { s, epoch, probing } of lease.shared)
      if (probing && s.epoch === epoch) s.probe = false;
    if (success && fresh) {
      lease.key.until = 0;
      for (const { s } of lease.shared) s.until = 0;
      cursor = lease.index;
    }
  }
  function unavailable() {
    const remaining = keys.filter((k) => !k.disabled);
    if (!remaining.length) return new Response(null, { status: 401 });
    if (remaining.every((k) => scopes(k).some((s) => s.denied)))
      return new Response(null, { status: 403 });
    const time = now();
    const waits = remaining
      .filter((k) => !scopes(k).some((s) => s.denied))
      .map(
        (k) =>
          Math.max(k.until, ...scopes(k).map((s) => s.until), time + 1000) -
          time,
      );
    return new Response(null, {
      status: 429,
      headers: {
        'retry-after': String(
          Math.max(1, Math.ceil(Math.min(...waits) / 1000)),
        ),
      },
    });
  }
  return Object.freeze({
    async fetch(
      url,
      init,
      {
        beforeRetry,
        attemptBudget,
        remainingTokens = Infinity,
        tokenCharge = 0,
      } = {},
    ) {
      if (
        url !== ENDPOINT ||
        init?.method !== 'POST' ||
        init.redirect !== 'error' ||
        typeof init.body !== 'string'
      )
        throw new Error('GROQ_FIXED_TRANSPORT_REQUIRED');
      const tried = new Set();
      const budget = attemptBudget ?? { attempts: 0, retryTokens: 0 };
      const initialCharge = budget.retryTokens;
      let attempt = 0;
      for (;;) {
        cancelled(init.signal);
        if (attempt && beforeRetry) await beforeRetry();
        cancelled(init.signal);
        const lease = select(tried);
        if (!lease) return unavailable();
        const { key, index } = lease;
        try {
          if (budget.attempts >= 8)
            throw new ServiceError(429, 'AGENT_MODEL_BUDGET_EXCEEDED');
          if (
            tokenCharge >
            remainingTokens - (budget.retryTokens - initialCharge)
          )
            throw new ServiceError(429, 'AGENT_TOKEN_BUDGET_EXCEEDED');
          tried.add(index);
          attempt++;
          budget.attempts++;
          const headers = new Headers(init.headers);
          headers.set('authorization', 'Bearer ' + key.apiKey);
          let response;
          try {
            response = await fetcher(url, {
              ...init,
              headers,
              redirect: 'error',
            });
          } catch {
            emit(key, 'transport-unavailable', attempt);
            throw new Error('GROQ_TRANSPORT_UNAVAILABLE');
          }
          if (response.ok) {
            release(lease, true);
            emit(key, 'success', attempt);
            return response;
          }
          const status = response.status;
          if (![400, 401, 403, 429].includes(status)) {
            emit(key, 'provider-unavailable', attempt);
            return response;
          }
          let error = {},
            bytes = null;
          if (status !== 401) ({ error, bytes } = await errorBody(response));
          const scope = failureScope(error);
          if (status === 400 && error.code !== 'blocked_api_access')
            return new Response(bytes, { status, headers: response.headers });
          if (status === 401 || (status === 403 && scope === 'key')) {
            await response.body?.cancel().catch(() => {});
            key.disabled = true;
            key.epoch++;
            key.probe = false;
            emit(key, 'credential-disabled', attempt);
          } else if (status === 403 || status === 400) {
            const target =
              scope === 'project' && key.project
                ? group('project:' + key.organization + ':' + key.project)
                : group('org:' + key.organization);
            block(target, 0, true);
            emit(key, 'group-access-denied', attempt);
            return new Response(null, { status: 403 });
          } else {
            const until = now() + groqRetryDelay(response.headers, now());
            block(key, until);
            const org = group('org:' + key.organization);
            if (scope === 'organization') {
              block(org, until);
              const observed = providerOrganization(error);
              if (observed) {
                key.providerOrganization = observed;
                block(group(observed), until);
              }
            } else if (scope === 'project' && key.project)
              block(
                group('project:' + key.organization + ':' + key.project),
                until,
              );
            else if (
              scope === 'unknown' ||
              (scope === 'project' && !key.project)
            ) {
              const unit = quotaUnit(error);
              const previous = org.lastUnknown;
              if (
                previous &&
                previous.id !== key.id &&
                previous.unit === unit &&
                previous.until > now()
              )
                block(org, Math.max(until, previous.until));
              org.lastUnknown = { id: key.id, unit, until };
            }
            emit(
              key,
              scope === 'unknown' ? 'quota-unknown' : 'quota-' + scope,
              attempt,
              until,
              quotaUnit(error),
            );
          }
          if (cursor === index) cursor = (index + 1) % keys.length;
          budget.retryTokens += tokenCharge;
        } finally {
          release(lease);
        }
      }
    },
    snapshot() {
      return keys.map((key) => ({
        id: key.id,
        state: key.disabled
          ? 'disabled'
          : key.until > now() ||
              scopes(key).some((s) => s.denied || s.until > now() || s.probe)
            ? 'unavailable'
            : 'ready',
      }));
    },
  });
}
