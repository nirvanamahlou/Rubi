import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGroqProvider } from './groq-provider.mjs';
import { CONVERSATION_ACTIONS, createOrchestrator } from './orchestrator.mjs';
const now = () => new Date('2026-10-14T08:00:00Z');
const input = {
  version: 1,
  message: 'synthetic',
  history: [],
  actions: CONVERSATION_ACTIONS,
};
const plan = {
  kind: 'ACTION',
  action: 'sales-analysis',
  field: null,
  startDate: '2026-10-01',
  endDate: '2026-10-13',
  originId: null,
  destinationId: null,
  branchId: null,
  reply: null,
};
const result = (value = plan, overrides = {}) =>
  new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: JSON.stringify(value), ...overrides },
        },
      ],
    }),
    { headers: { 'content-type': 'application/json' } },
  );

test('Groq transport uses fixed endpoint, bounded strict schema and allowlisted message only', async () => {
  const provider = createGroqProvider({
    apiKey: 'synthetic-key',
    now,
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.authorization, 'Bearer synthetic-key');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'openai/gpt-oss-120b');
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(body.max_completion_tokens, 512);
      assert.equal(body.tools, undefined);
      assert.match(body.messages[0].content, /2026-10-14/);
      assert.deepEqual(JSON.parse(body.messages[1].content), {
        version: 1,
        message: 'synthetic',
        history: [],
      });
      assert.ok(!options.body.includes('cookie-secret'));
      return result();
    },
  });
  // Direct transport projection also excludes irrelevant trusted caller properties.
  const output = await provider.plan(
    { ...input, cookie: 'cookie-secret' },
    { maxOutputTokens: 999 },
  );
  assert.equal(output.action, 'sales-analysis');
});

test('Groq planner integrates with existing orchestrator and exact backend evidence', async () => {
  const provider = createGroqProvider({
    apiKey: 'test',
    now,
    fetchImpl: async () => result(),
  });
  const run = createOrchestrator({ provider, enabled: true, now });
  const answer = await run(
    { version: 1, message: 'synthetic', history: [] },
    {
      signal: new AbortController().signal,
      runAction: async () => ({ amount: '9007199254740993.0001' }),
    },
  );
  assert.equal(answer.evidence.amount, '9007199254740993.0001');
});

test('forged/write/extra/incomplete/invalid filters and model tool calls fail closed', async () => {
  for (const value of [
    { ...plan, action: 'execute_sql' },
    { ...plan, amount: '100' },
    { ...plan, branchId: 'administrator' },
    { ...plan, startDate: '2020-01-01' },
    { ...plan, endDate: '2026-10-14' },
    { ...plan, startDate: null },
    { ...plan, kind: 'CLARIFY', field: 'ROUTE' },
  ]) {
    const provider = createGroqProvider({
      apiKey: 'test',
      now,
      fetchImpl: async () => result(value),
    });
    await assert.rejects(provider.plan(input), { message: 'INVALID_PLAN' });
  }
  const provider = createGroqProvider({
    apiKey: 'test',
    now,
    fetchImpl: async () => result(plan, { tool_calls: [] }),
  });
  await assert.rejects(provider.plan(input), { message: 'INVALID_PLAN' });
});

test('clarification strips no requested scope and returns fixed code only', async () => {
  const value = Object.fromEntries(Object.keys(plan).map((key) => [key, null]));
  Object.assign(value, { kind: 'CLARIFY', field: 'ROUTE' });
  const provider = createGroqProvider({
    apiKey: 'test',
    now,
    fetchImpl: async () => result(value),
  });
  assert.deepEqual(await provider.plan(input), {
    kind: 'CLARIFY',
    field: 'ROUTE',
  });
});

test('provider errors/rate limits are generic, never echoed, never retried', async () => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    const provider = createGroqProvider({
      apiKey: 'secret-key',
      fetchImpl: async () => {
        calls++;
        return new Response('secret-key private upstream error', { status });
      },
    });
    await assert.rejects(provider.plan(input), {
      message:
        status === 429 ? 'PROVIDER_RATE_LIMITED' : 'CONVERSATION_UNAVAILABLE',
    });
    assert.equal(calls, 1);
  }
});

test('oversized responses, aborted requests and missing credentials fail safely', async () => {
  assert.throws(() => createGroqProvider({ apiKey: '' }), {
    message: 'PROVIDER_NOT_CONFIGURED',
  });
  const provider = createGroqProvider({
    apiKey: 'test',
    fetchImpl: async () =>
      new Response('x'.repeat(65537), {
        headers: { 'content-type': 'application/json' },
      }),
  });
  await assert.rejects(provider.plan(input), { message: 'INVALID_PLAN' });
  let calls = 0;
  const blocked = createGroqProvider({
    apiKey: 'test',
    fetchImpl: async () => {
      calls++;
      throw Error('secret');
    },
  });
  await assert.rejects(blocked.plan(input, { signal: AbortSignal.abort() }), {
    message: 'CONVERSATION_TIMEOUT',
  });
  assert.equal(calls, 0);
  await assert.rejects(blocked.plan(input), {
    message: 'CONVERSATION_UNAVAILABLE',
  });
});

test('cancellation during provider I/O aborts without leaking the upstream exception', async () => {
  let calls = 0;
  const provider = createGroqProvider({
    apiKey: 'secret',
    fetchImpl: async (_url, { signal }) => {
      calls++;
      return new Promise((_resolve, reject) =>
        signal.addEventListener(
          'abort',
          () => reject(Error('secret upstream detail')),
          { once: true },
        ),
      );
    },
  });
  await assert.rejects(
    provider.plan(input, { signal: AbortSignal.timeout(20) }),
    { message: 'CONVERSATION_TIMEOUT' },
  );
  assert.equal(calls, 1);
});

test('plain conversational replies require null action/scope and remain bounded', async () => {
  const reply = Object.fromEntries(Object.keys(plan).map((key) => [key, null]));
  Object.assign(reply, { kind: 'REPLY', reply: 'Hello' });
  const provider = createGroqProvider({
    apiKey: 'test',
    now,
    fetchImpl: async () => result(reply),
  });
  assert.deepEqual(await provider.plan(input), {
    kind: 'REPLY',
    text: 'Hello',
  });
  for (const bad of [
    { ...reply, action: 'sales-analysis' },
    { ...reply, reply: 'x'.repeat(2001) },
    { ...reply, reply: ' ' },
  ]) {
    await assert.rejects(
      createGroqProvider({
        apiKey: 'test',
        now,
        fetchImpl: async () => result(bad),
      }).plan(input),
      /INVALID_PLAN/,
    );
  }
});
