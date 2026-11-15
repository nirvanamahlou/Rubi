import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataAgent, validateDataAgentMessage } from './data-agent.mjs';
import { createAgentProvider } from './agent-provider.mjs';
import { dataAgentConfiguration } from './agent-config.mjs';

const contextId = 'a'.repeat(64);
const resultId = '12345678-1234-1234-1234-123456789abc';
const message = { version: 1, message: 'فروش این ماه چقدر بوده؟', history: [] };
const signal = () => new AbortController().signal;
const catalog = {
  version: 1,
  contextId,
  sources: [
    {
      id: 'amounts',
      columns: ['contract_id', 'currency_code', 'amount'],
      description: 'Amounts before refunds',
      grain: 'contract/currency',
    },
  ],
  rules: ['Keep currencies separate'],
};
const step = (name, args, n = 1) => ({
  id: `call_${n}`,
  name,
  args,
  tokens: 30,
});
const plan = step('set_plan', { steps: ['بررسی مبلغ قراردادهای مجاز'] });
const describe = step('catalog_describe', { source: 'amounts' }, 2);
const query = step(
  'database_query',
  {
    sql: 'SELECT currency_code, sum(amount) AS total FROM amounts GROUP BY currency_code',
  },
  3,
);
const finish = step(
  'finish_answer',
  {
    status: 'ANSWER',
    text: 'فروش 100.0000 USD است.',
    resultIds: [resultId],
    limitations: ['قبل از استرداد'],
  },
  4,
);
const result = {
  version: 1,
  contextId,
  resultId,
  rows: [{ currency_code: 'USD', total: '100.0000' }],
  columns: ['currency_code', 'total'],
  sources: ['amounts'],
  observedAt: '2026-11-14T10:00:00Z',
  truncated: false,
  queryHash: 'b'.repeat(64),
  durationMs: 2,
};
function harness(steps = [plan, describe, query, finish], override) {
  const calls = [];
  const payloads = [];
  const audits = [];
  let index = 0;
  const agent = createDataAgent({
    enabled: true,
    erpBaseUrl: 'http://127.0.0.1:4301/api/v1',
    audit: (value) => audits.push(value),
    provider: {
      async step(messages) {
        payloads.push(structuredClone(messages));
        return steps[index++];
      },
    },
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return (
        override?.(url, options, calls) ??
        Response.json(url.endsWith('/catalog') ? catalog : result)
      );
    },
  });
  return { agent, calls, payloads, audits };
}
test('agent plans, queries real tool output and transmits evidence to the model before grounded final answer', async () => {
  const h = harness();
  const response = await h.agent(message, {
    cookie: 'nora_access=synthetic',
    signal: signal(),
  });
  assert.equal(response.version, 3);
  assert.equal(response.sources[0].resultId, resultId);
  assert.match(JSON.stringify(h.payloads.at(-1)), /100\.0000/);
  assert.doesNotMatch(JSON.stringify(h.payloads), /nora_access/);
  assert.equal(
    h.calls.filter((call) => call.options.method === 'POST').length,
    1,
  );
  assert.equal(
    JSON.parse(
      h.calls.find((call) => call.options.method === 'POST').options.body,
    ).contextId,
    contextId,
  );
  assert.doesNotMatch(JSON.stringify(h.audits), /100\.0000|SELECT|synthetic/);
});
test('agent stays disabled by default and requires the newly approved policy explicitly', async () => {
  assert.deepEqual(dataAgentConfiguration({}), { enabled: false });
  assert.throws(() =>
    dataAgentConfiguration({
      ASSISTANT_AGENT_ENABLED: 'true',
      ASSISTANT_DATA_POLICY: 'messages-only',
    }),
  );
  await assert.rejects(
    createDataAgent()(message, { signal: signal() }),
    /AGENT_DISABLED/,
  );
});

test('selected-record context is a bounded UUID hint and cannot carry authorization', () => {
  const input = { ...message, context: { selectedContractId: resultId } };
  assert.equal(
    validateDataAgentMessage(input).context.selectedContractId,
    resultId,
  );
  assert.throws(
    () =>
      validateDataAgentMessage({
        ...input,
        context: { selectedContractId: resultId, branchIds: ['other'] },
      }),
    /INVALID_MESSAGE/,
  );
  assert.throws(
    () =>
      validateDataAgentMessage({
        ...input,
        context: { selectedContractId: 'SELECT * FROM secrets' },
      }),
    /INVALID_MESSAGE/,
  );
});
test('agent refuses a forged plan or evidence-free factual answer', async () => {
  for (const steps of [
    [query],
    [plan, step('finish_answer', { ...finish.args, resultIds: [] })],
    [plan, step('finish_answer', { ...finish.args, resultIds: ['invented'] })],
  ]) {
    await assert.rejects(
      harness(steps).agent(message, {
        cookie: 'nora_access=x',
        signal: signal(),
      }),
      /INVALID_AGENT_PLAN|AGENT_EVIDENCE_REQUIRED/,
    );
  }
});
test('material ambiguity returns clarification without querying', async () => {
  const h = harness([
    plan,
    step(
      'finish_answer',
      {
        status: 'CLARIFY',
        text: 'منظور مبلغ قرارداد است یا وصول؟',
        resultIds: [],
        limitations: [],
      },
      2,
    ),
  ]);
  const response = await h.agent(message, {
    cookie: 'nora_access=x',
    signal: signal(),
  });
  assert.equal(response.status, 'CLARIFY');
  assert.ok(h.calls.every((call) => call.options.method === 'GET'));
});
test('source denial and company/context changes prevent additional model transmission', async () => {
  for (const status of [401, 403]) {
    const h = harness(undefined, (_url, _options, calls) =>
      calls.length > 3 ? new Response('', { status }) : undefined,
    );
    await assert.rejects(
      h.agent(message, { cookie: 'nora_access=x', signal: signal() }),
      /UNAUTHENTICATED|FORBIDDEN/,
    );
    assert.ok(h.payloads.length <= 2);
  }
  const h = harness(undefined, (url, _options, calls) =>
    calls.length > 4 && url.endsWith('/catalog')
      ? Response.json({ ...catalog, contextId: 'c'.repeat(64) })
      : undefined,
  );
  await assert.rejects(
    h.agent(message, { cookie: 'nora_access=x', signal: signal() }),
    /AGENT_CONTEXT_CHANGED/,
  );
  assert.equal(h.payloads.length, 3);
});
test('SQL rejection permits bounded repair and truncation becomes an explicit limitation', async () => {
  let queries = 0;
  const h = harness(
    [plan, describe, query, { ...query, id: 'repair' }, finish],
    (url) => {
      if (url.endsWith('/query'))
        return ++queries === 1
          ? new Response('', { status: 400 })
          : Response.json({ ...result, truncated: true });
    },
  );
  const response = await h.agent(message, {
    cookie: 'nora_access=x',
    signal: signal(),
  });
  assert.equal(queries, 2);
  assert.match(response.limitations.join(' '), /limited/);
});
test('step, query, token and cancellation budgets fail closed', async () => {
  const repeated = [
    plan,
    describe,
    ...Array.from({ length: 7 }, (_, i) => ({ ...query, id: `query_${i}` })),
  ];
  await assert.rejects(
    harness(repeated).agent(message, {
      cookie: 'nora_access=x',
      signal: signal(),
    }),
    /AGENT_STEP_BUDGET_EXCEEDED/,
  );
  await assert.rejects(
    harness([{ ...plan, tokens: 40001 }]).agent(message, {
      cookie: 'nora_access=x',
      signal: signal(),
    }),
    /AGENT_TOKEN_BUDGET_EXCEEDED/,
  );
  const controller = new AbortController();
  controller.abort();
  const h = harness();
  await assert.rejects(
    h.agent(message, { cookie: 'nora_access=x', signal: controller.signal }),
    /AGENT_TIMEOUT/,
  );
  assert.equal(h.payloads.length, 0);
});
test('provider executes native local tool calling with fixed destination and bounded plaintext data', async () => {
  let sent;
  const provider = createAgentProvider({
    apiKey: 'synthetic-key',
    fetcher: async (url, options) => {
      sent = { url, options };
      return Response.json({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'set_plan',
                    arguments: JSON.stringify(plan.args),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 10 },
      });
    },
  });
  const response = await provider.step([{ role: 'user', content: 'سلام' }], {
    signal: signal(),
  });
  assert.equal(response.name, 'set_plan');
  assert.equal(sent.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(sent.options.redirect, 'error');
  assert.equal(JSON.parse(sent.options.body).parallel_tool_calls, false);
});

test('enabled runtime requires Germany CONNECT egress and refuses bypass or direct fallback', () => {
  const env = {
    ASSISTANT_AGENT_ENABLED: 'true',
    ASSISTANT_DATA_POLICY: 'authorized-erp-results',
    ASSISTANT_MODEL_PROVIDER: 'groq',
    GROQ_API_KEY: 'synthetic',
    ASSISTANT_GROQ_EGRESS: 'germany-proxy',
    NODE_USE_ENV_PROXY: '1',
    HTTPS_PROXY: 'http://127.0.0.1:4310',
    NO_PROXY: 'localhost,127.0.0.1',
  };
  assert.equal(dataAgentConfiguration(env).enabled, true);
  for (const override of [
    { HTTPS_PROXY: '' },
    { NODE_USE_ENV_PROXY: '' },
    { NO_PROXY: 'api.groq.com' },
    { HTTPS_PROXY: 'http://example.com:4310' },
    { ASSISTANT_GROQ_EGRESS: 'direct' },
  ]) {
    assert.throws(
      () => dataAgentConfiguration({ ...env, ...override }),
      /AGENT_GERMANY_PROXY_REQUIRED/,
    );
  }
});
