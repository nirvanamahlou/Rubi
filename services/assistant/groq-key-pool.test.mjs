import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGroqKeyPool, groqRetryDelay } from './groq-key-pool.mjs';
import {
  readGroqCredentials,
  validateGroqCredentials,
} from './groq-credentials.mjs';

const endpoint = 'https://api.groq.com/openai/v1/chat/completions';
const entries = ['a', 'b', 'c'].map((id) => ({
  id: 'groq-' + id,
  organization: 'groq-main',
  apiKey: 'synthetic-' + id,
}));
const init = () => ({
  method: 'POST',
  redirect: 'error',
  body: '{"synthetic":true}',
  signal: new AbortController().signal,
});
const error = (status, scope, code = 'rate_limit_exceeded') =>
  Response.json(
    { error: { scope, code, message: 'Synthetic TPM limit' } },
    { status, headers: { 'retry-after': '2' } },
  );
function harness(responses, options = {}) {
  const sent = [],
    audit = [];
  const pool = createGroqKeyPool({
    entries,
    audit: (x) => audit.push(x),
    fetcher: async (_url, request) => {
      sent.push(request);
      const response = responses.shift();
      return typeof response === 'function' ? response(request) : response;
    },
    ...options,
  });
  return {
    pool,
    sent,
    audit,
    run: (context) => pool.fetch(endpoint, init(), context),
  };
}

test('private credential file wins, deduplicates and rejects invalid configuration without leaking', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nora-pool-'));
  const path = join(directory, 'keys.json');
  try {
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        keys: [...entries, { ...entries[0], id: 'duplicate' }],
      }),
      { mode: 0o600 },
    );
    assert.equal(
      readGroqCredentials({ GROQ_KEY_POOL_FILE: path, GROQ_API_KEY: 'ignored' })
        .length,
      3,
    );
    assert.equal(readGroqCredentials({ GROQ_API_KEY: 'synthetic' }).length, 1);
    writeFileSync(path, '{"apiKey":"secret-invalid"}');
    assert.throws(
      () => readGroqCredentials({ GROQ_KEY_POOL_FILE: path }),
      /^Error: GROQ_POOL_CONFIGURATION_INVALID$/,
    );
    assert.throws(
      () => readGroqCredentials({ GROQ_KEY_POOL_FILE: 'relative' }),
      /CONFIGURATION_INVALID/,
    );
    assert.throws(
      () =>
        validateGroqCredentials({
          version: 1,
          keys: [{ ...entries[0], enabled: 'yes' }],
        }),
      /CONFIGURATION_INVALID/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('invalid credential advances once and successful replacement stays current', async () => {
  const h = harness([error(401), new Response('ok'), new Response('ok')]);
  assert.equal((await h.run()).status, 200);
  await h.run();
  assert.deepEqual(
    h.sent.map((x) => x.headers.get('authorization')),
    ['Bearer synthetic-a', 'Bearer synthetic-b', 'Bearer synthetic-b'],
  );
  assert.equal(h.pool.snapshot()[0].state, 'disabled');
  assert.equal(JSON.stringify(h.audit).includes('synthetic-'), false);
  assert.equal(JSON.stringify(h.pool.snapshot()).includes('apiKey'), false);
});

test('disabled entries are skipped and all revoked credentials terminate', async () => {
  const h = harness([error(401), error(401)], {
    entries: [{ ...entries[0], enabled: false }, ...entries.slice(1)],
  });
  assert.equal((await h.run()).status, 401);
  assert.equal(h.sent.length, 2);
  assert.equal((await h.run()).status, 401);
  assert.equal(h.sent.length, 2);
});

test('organization quota stops the entire organization without trying another key', async () => {
  const h = harness([error(429, 'organization')]);
  assert.equal((await h.run()).status, 429);
  assert.equal((await h.run()).status, 429);
  assert.equal(h.sent.length, 1);
});

test('one organization quota skips its peers and reaches a different organization', async () => {
  const h = harness(
    [error(429, 'organization'), new Response('ok'), new Response('ok')],
    {
      entries: entries.map((x, i) => ({
        ...x,
        organization: i < 2 ? 'org-first' : 'org-second',
      })),
    },
  );
  assert.equal((await h.run()).status, 200);
  await h.run();
  assert.deepEqual(
    h.sent.map((x) => x.headers.get('authorization')),
    ['Bearer synthetic-a', 'Bearer synthetic-c', 'Bearer synthetic-c'],
  );
  assert.equal(h.pool.snapshot()[0].state, 'unavailable');
  assert.equal(h.pool.snapshot()[1].state, 'unavailable');
  assert.equal(h.audit[0].limitUnit, 'TPM');
});

test('matching quota words do not join independently configured organizations', async () => {
  const h = harness([error(429), error(429), new Response('ok')], {
    entries: entries.map((x, i) => ({ ...x, organization: 'org-' + i })),
  });
  assert.equal((await h.run()).status, 200);
  assert.equal(h.sent.length, 3);
});

test('provider-confirmed organization identity links provisional aliases without logging identity', async () => {
  let time = 1000;
  const shared = () =>
    Response.json(
      {
        error: {
          scope: 'organization',
          organization_id: 'org_synthetic_shared',
          message: 'TPM limit in organization org_synthetic_shared',
        },
      },
      { status: 429, headers: { 'retry-after': '2' } },
    );
  const h = harness(
    [shared(), shared(), new Response('ok'), shared(), new Response('ok')],
    {
      now: () => time,
      entries: entries.map((x, i) => ({ ...x, organization: 'org-' + i })),
    },
  );
  await h.run();
  assert.equal(h.sent.length, 3);
  time = 4000;
  // A separate synthetic request needs to return to the first credential to probe:
  // make the current healthy credential temporarily key-limited, then learn that
  // one shared organization still excludes both previously identified credentials.
  h.sent.length = 0;
  const before = h.pool.snapshot();
  assert.equal(
    before.every((x) => x.state === 'ready'),
    true,
  );
  // Current credential is C: it reports the same provider organization, which
  // must suppress A and B even though operator aliases differ.
  assert.equal((await h.run()).status, 429);
  assert.equal(h.sent.length, 1);
  const metadata = JSON.stringify({
    audit: h.audit,
    snapshot: h.pool.snapshot(),
  });
  assert.equal(metadata.includes('org_synthetic_shared'), false);
  assert.equal(
    h.pool.snapshot().every((x) => x.state === 'unavailable'),
    true,
  );
});

test('unknown quota allows only one diagnostic replacement before grouping', async () => {
  const h = harness([error(429), error(429)]);
  assert.equal((await h.run()).status, 429);
  assert.equal(h.sent.length, 2);
  await h.run();
  assert.equal(h.sent.length, 2);
});

test('explicit key quota permits the next healthy credential', async () => {
  const h = harness([error(429, 'key'), new Response('ok')]);
  assert.equal((await h.run()).status, 200);
  assert.equal(h.sent.length, 2);
});

test('explicit key scope and key error codes outrank organization wording', async () => {
  for (const details of [
    { scope: 'key' },
    { code: 'key_rate_limit_exceeded' },
  ]) {
    const h = harness([
      Response.json(
        {
          error: {
            ...details,
            message: 'Key limit in organization synthetic-main',
          },
        },
        { status: 429 },
      ),
      new Response('ok'),
    ]);
    assert.equal((await h.run()).status, 200);
    assert.equal(h.sent.length, 2);
  }
});

test('project quota skips only known project peers', async () => {
  const h = harness([error(429, 'project'), new Response('ok')], {
    entries: entries.map((x, i) => ({
      ...x,
      project: i < 2 ? 'project-a' : 'project-b',
    })),
  });
  assert.equal((await h.run()).status, 200);
  assert.deepEqual(
    h.sent.map((x) => x.headers.get('authorization')),
    ['Bearer synthetic-a', 'Bearer synthetic-c'],
  );
});

test('shared policy denial does not rotate; explicit key denial does', async () => {
  const blocked = harness([error(403)]);
  assert.equal((await blocked.run()).status, 403);
  await blocked.run();
  assert.equal(blocked.sent.length, 1);
  const key = harness([
    error(403, 'key', 'key_permission_denied'),
    new Response('ok'),
  ]);
  assert.equal((await key.run()).status, 200);
});

for (const status of [400, 500, 503])
  test(`non-key ${status} is returned unchanged without rotation`, async () => {
    const h = harness([
      error(
        status,
        undefined,
        status === 400 ? 'tool_use_failed' : 'unavailable',
      ),
    ]);
    const response = await h.run();
    assert.equal(response.status, status);
    assert.equal(h.sent.length, 1);
    assert.equal(h.pool.snapshot()[0].state, 'ready');
    if (status === 400)
      assert.equal((await response.json()).error.code, 'tool_use_failed');
  });

test('transport error is sanitized and never tries another key', async () => {
  const h = harness([
    () => {
      throw new Error('private transport detail');
    },
  ]);
  await assert.rejects(h.run(), /^Error: GROQ_TRANSPORT_UNAVAILABLE$/);
  assert.equal(h.sent.length, 1);
});

test('Retry-After seconds/date and exhausted reset headers are respected', () => {
  assert.equal(groqRetryDelay(new Headers({ 'retry-after': '2' }), 0), 2000);
  assert.equal(
    groqRetryDelay(
      new Headers({ 'retry-after': 'Thu, 01 Jan 1970 00:00:03 GMT' }),
      0,
    ),
    3000,
  );
  assert.equal(
    groqRetryDelay(
      new Headers({
        'retry-after': '2',
        'x-ratelimit-remaining-requests': '0',
        'x-ratelimit-reset-requests': '2m3.5s',
      }),
      0,
    ),
    123500,
  );
  assert.equal(
    groqRetryDelay(new Headers({ 'retry-after': 'invalid' }), 0),
    60000,
  );
});

test('expired shared cooldown permits one half-open probe only', async () => {
  let time = 1000,
    resolve;
  const h = harness(
    [
      error(429, 'organization'),
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ],
    { now: () => time },
  );
  await h.run();
  time = 4000;
  const probe = h.run();
  await Promise.resolve();
  assert.equal((await h.run()).status, 429);
  assert.equal(h.sent.length, 2);
  resolve(new Response('ok'));
  assert.equal((await probe).status, 200);
  assert.equal(
    h.pool.snapshot().every((x) => x.state === 'ready'),
    true,
  );
});

test('late success cannot clear a newly observed cooldown or replace sticky key', async () => {
  let resolve;
  const h = harness([
    () =>
      new Promise((r) => {
        resolve = r;
      }),
    error(429, 'key'),
    new Response('ok'),
    new Response('ok'),
  ]);
  const stale = h.run();
  await Promise.resolve();
  await h.run();
  resolve(new Response('ok'));
  await stale;
  await h.run();
  assert.equal(h.pool.snapshot()[0].state, 'unavailable');
  assert.equal(
    h.sent.at(-1).headers.get('authorization'),
    'Bearer synthetic-b',
  );
});

test('retry uses identical payload/signal and revalidates native authorization', async () => {
  const h = harness([error(401), new Response('ok')]);
  let checks = 0;
  await h.run({
    beforeRetry: async () => {
      checks++;
    },
  });
  assert.equal(checks, 1);
  assert.equal(h.sent[0].body, h.sent[1].body);
  assert.equal(h.sent[0].signal, h.sent[1].signal);
  const revoked = harness([error(401)]);
  await assert.rejects(
    revoked.run({
      beforeRetry: () => {
        throw new Error('FORBIDDEN');
      },
    }),
    /FORBIDDEN/,
  );
  assert.equal(revoked.sent.length, 1);
});

test('abort before replacement prevents any new model attempt', async () => {
  const controller = new AbortController();
  const h = harness([error(401)]);
  await assert.rejects(
    h.pool.fetch(
      endpoint,
      { ...init(), signal: controller.signal },
      { beforeRetry: () => controller.abort() },
    ),
    /ABORTED/,
  );
  assert.equal(h.sent.length, 1);
});

test('replacement consumes original model and token budgets', async () => {
  const attempts = harness([error(401)]);
  const budget = { attempts: 7, retryTokens: 0 };
  await assert.rejects(attempts.run({ attemptBudget: budget }), /MODEL_BUDGET/);
  assert.equal(budget.attempts, 8);
  assert.equal(attempts.sent.length, 1);
  const tokens = harness([error(401)]);
  const tokenBudget = { attempts: 0, retryTokens: 0 };
  await assert.rejects(
    tokens.run({
      attemptBudget: tokenBudget,
      remainingTokens: 150,
      tokenCharge: 100,
    }),
    /TOKEN_BUDGET/,
  );
  assert.equal(tokenBudget.retryTokens, 100);
  assert.equal(tokens.sent.length, 1);
});

test('fixed endpoint and redirect admission cannot be bypassed', async () => {
  const h = harness([]);
  await assert.rejects(
    h.pool.fetch('https://example.com', init()),
    /FIXED_TRANSPORT/,
  );
  await assert.rejects(
    h.pool.fetch(endpoint, { ...init(), redirect: 'follow' }),
    /FIXED_TRANSPORT/,
  );
  assert.equal(h.sent.length, 0);
});

test('disabled entries are skipped and all invalid credentials finish without cycling', async () => {
  const h = harness([error(401), error(401)], {
    entries: entries.map((x, i) => ({ ...x, enabled: i !== 0 })),
  });
  assert.equal((await h.run()).status, 401);
  assert.equal(h.sent.length, 2);
  assert.equal(h.sent[0].headers.get('authorization'), 'Bearer synthetic-b');
  assert.equal((await h.run()).status, 401);
  assert.equal(h.sent.length, 2);
});

test('operational audit and snapshots exclude credentials, prompt and upstream body', async () => {
  const h = harness([error(401), new Response('ok')]);
  await h.pool.fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    body: 'private-prompt',
  });
  const metadata = JSON.stringify({
    audit: h.audit,
    snapshot: h.pool.snapshot(),
  });
  for (const forbidden of [
    'synthetic-',
    'private-prompt',
    'Synthetic TPM',
    'authorization',
    'apiKey',
  ])
    assert.equal(metadata.includes(forbidden), false);
  assert.equal(h.audit[0].category, 'credential-disabled');
});
