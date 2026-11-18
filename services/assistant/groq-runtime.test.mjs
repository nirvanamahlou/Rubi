import test from 'node:test';
import assert from 'node:assert/strict';
import { groqConfigurations } from './groq-runtime.mjs';
import { createWorkbenchGuideSelector } from './workbench-guide.mjs';
import { dataAgentConfiguration } from './agent-config.mjs';
import { createGroqKeyPool } from './groq-key-pool.mjs';
import { createAgentProvider } from './agent-provider.mjs';
import { createDataAgent } from './data-agent.mjs';

const env = {
  ASSISTANT_AGENT_ENABLED: 'true',
  ASSISTANT_MODEL_PROVIDER: 'groq',
  ASSISTANT_DATA_POLICY: 'authorized-erp-results',
  ASSISTANT_GROQ_EGRESS: 'germany-proxy',
  NODE_USE_ENV_PROXY: '1',
  HTTPS_PROXY: 'http://127.0.0.1:4310',
  GROQ_API_KEY: 'synthetic-primary',
};
const signal = () => new AbortController().signal;
const guide = { version: 1, topicId: 'leave', goal: 'steps' };
test('one runtime shares organization cooldown between guide and data Agent', async () => {
  let calls = 0;
  const configs = groqConfigurations(env, {
    fetcher: async () => {
      calls++;
      return Response.json(
        { error: { scope: 'organization' } },
        { status: 429, headers: { 'retry-after': '60' } },
      );
    },
  });
  const selector = createWorkbenchGuideSelector(configs.workbenchGuide);
  assert.equal((await selector(guide, signal())).selection, 'internal');
  await assert.rejects(
    configs.agent.provider.step([], { signal: signal() }),
    /RATE_LIMITED/,
  );
  assert.equal(calls, 1);
});
test('pool admission preserves Germany requirements and rejects bypassed custom startup', () => {
  assert.throws(
    () => groqConfigurations({ ...env, NO_PROXY: 'api.groq.com' }),
    /GERMANY_PROXY/,
  );
  assert.throws(
    () =>
      dataAgentConfiguration({ ...env, GROQ_KEY_POOL_FILE: 'private.json' }),
    /SHARED_POOL_REQUIRED/,
  );
  assert.deepEqual(groqConfigurations({}), {
    agent: { enabled: false },
    conversation: { enabled: false },
    workbenchGuide: {},
  });
});

const contextId = 'a'.repeat(64),
  resultId = '12345678-1234-1234-1234-123456789abc';
const catalog = {
  version: 1,
  contextId,
  sources: [
    {
      id: 'amounts',
      description: 'Contract amounts',
      columns: ['currency_code', 'amount'],
    },
  ],
  rules: [],
};
const result = {
  version: 1,
  contextId,
  resultId,
  rows: [{ currency_code: 'USD', total: '100.0000' }],
  columns: ['currency_code', 'total'],
  sources: ['amounts'],
  observedAt: '2026-11-17T10:00:00Z',
  truncated: false,
  queryHash: 'b'.repeat(64),
  durationMs: 2,
};
const steps = [
  ['set_plan', { steps: ['بررسی مبلغ'] }],
  ['catalog_describe', { source: 'amounts' }],
  [
    'database_query',
    {
      sql: 'SELECT currency_code, sum(amount) AS total FROM amounts GROUP BY currency_code',
    },
  ],
  [
    'json',
    {
      status: 'ANSWER',
      text: 'مبلغ 100 USD است.',
      resultIds: [resultId],
      limitations: [],
    },
  ],
];
function integration(revoke = false) {
  let model = 0,
    sql = 0,
    revoked = false;
  const sent = [];
  const transport = createGroqKeyPool({
    entries: [
      { id: 'first', organization: 'main', apiKey: 'synthetic-one' },
      { id: 'second', organization: 'main', apiKey: 'synthetic-two' },
    ],
    fetcher: async (_url, options) => {
      sent.push(options);
      model++;
      if (model === 4) {
        revoked = revoke;
        return new Response(null, { status: 401 });
      }
      const [name, args] = steps[model > 4 ? model - 2 : model - 1];
      return Response.json({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [
                {
                  id: 'call_' + model,
                  type: 'function',
                  function: { name, arguments: JSON.stringify(args) },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 10 },
      });
    },
  });
  const agent = createDataAgent({
    enabled: true,
    provider: createAgentProvider({ transport }),
    erpBaseUrl: 'http://127.0.0.1:4301/api/v1',
    fetcher: async (url, options) => {
      if (revoked) return new Response(null, { status: 403 });
      if (options.method === 'POST') sql++;
      return Response.json(url.endsWith('/catalog') ? catalog : result);
    },
  });
  return {
    run: () =>
      agent(
        {
          version: 1,
          message: 'جمع مبلغ قراردادها به دلار چقدر است؟',
          history: [],
        },
        { signal: signal(), cookie: 'synthetic-session' },
      ),
    stats: () => ({ model, sql }),
    sent,
  };
}
test('real Agent/provider/pool pipeline retries final model call without repeating SQL', async () => {
  const h = integration();
  const response = await h.run();
  assert.equal(response.status, 'ANSWER');
  assert.deepEqual(h.stats(), { model: 5, sql: 1 });
  assert.equal(h.sent[3].body, h.sent[4].body);
  assert.equal(h.sent[3].signal, h.sent[4].signal);
  assert.equal(h.sent[4].headers.get('authorization'), 'Bearer synthetic-two');
  assert.equal(response.sources[0].resultId, resultId);
});
test('revocation after model failure prevents replay of already acquired SQL evidence', async () => {
  const h = integration(true);
  await assert.rejects(h.run(), /FORBIDDEN/);
  assert.deepEqual(h.stats(), { model: 4, sql: 1 });
});
