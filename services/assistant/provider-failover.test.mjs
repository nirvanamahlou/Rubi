import test from 'node:test';
import assert from 'node:assert/strict';
import { quotaFailover } from './provider-failover.mjs';
import { ServiceError } from './errors.mjs';
import { dataAgentConfiguration } from './agent-config.mjs';
import { createGroqKeyPool } from './groq-key-pool.mjs';
import { validateDataAgentMessage } from './data-agent.mjs';
import { createWorkbenchGuideSelector } from './workbench-guide.mjs';

const limited = () => new ServiceError(429, 'AGENT_PROVIDER_RATE_LIMITED');
const signal = () => new AbortController().signal;
test('privileged guide quota uses GPT with identical allowlisted topic after reauthentication', async () => {
  const input = { version: 1, topicId: 'leave', goal: 'steps' };
  let secondaryCalls = 0,
    scopeChecks = 0;
  const select = createWorkbenchGuideSelector({
    transport: { fetch: async () => new Response('{}', { status: 429 }) },
    openaiTransport: {
      fetch: async (url, init) => {
        secondaryCalls++;
        assert.equal(url, 'https://api.openai.com/v1/chat/completions');
        const body = JSON.parse(init.body);
        assert.equal(body.model, 'gpt-6.1-sol');
        assert.equal(body.reasoning_effort, 'low');
        assert.deepEqual(JSON.parse(body.messages[1].content), input);
        return Response.json({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  call: {
                    name: 'workbench_guide',
                    arguments: { topicId: input.topicId, goal: input.goal },
                  },
                }),
              },
            },
          ],
        });
      },
    },
  });
  assert.equal((await select(input, signal())).selection, 'internal');
  assert.equal(secondaryCalls, 0);
  assert.equal(
    (
      await select(input, signal(), {
        consumptionExempt: true,
        beforeRetry: async () => {
          scopeChecks++;
        },
      })
    ).selection,
    'model',
  );
  assert.equal(secondaryCalls, 1);
  assert.equal(scopeChecks, 1);
});
test('quota failover preserves request state and revalidates before secondary; subsequent turns stick to working model', async () => {
  const messages = [{ role: 'tool', content: 'Current authorized evidence' }];
  const order = [];
  const a = {
    model: 'groq',
    step: async () => {
      order.push('groq');
      throw limited();
    },
  };
  const b = {
    model: 'gpt',
    step: async (m, o) => {
      order.push('gpt');
      assert.equal(m, messages);
      assert.equal(o, options);
      return { tokens: 50 };
    },
  };
  const options = {
    signal: signal(),
    currentResultIds: ['trusted'],
    beforeRetry: async () => {
      order.push('scope');
    },
  };
  const router = quotaFailover(a, b);
  await router.step(messages, options);
  await router.step(messages, options);
  assert.deepEqual(order, ['groq', 'scope', 'gpt', 'gpt']);
  assert.equal(router.model, 'gpt');
});
test('both providers exhausted fail once each, without recursion or invented answer', async () => {
  let calls = 0;
  const p = () => ({
    step: async () => {
      calls++;
      throw limited();
    },
  });
  await assert.rejects(
    quotaFailover(p(), p()).step([], { signal: signal() }),
    /AGENT_PROVIDER_RATE_LIMITED/,
  );
  assert.equal(calls, 2);
});
test('reverse fallback can return to recovered Groq on a later GPT quota failure', async () => {
  let groq = 0,
    gpt = 0;
  const router = quotaFailover(
    {
      model: 'groq',
      step: async () => {
        if (++groq === 1) throw limited();
        return 'recovered';
      },
    },
    {
      model: 'gpt',
      step: async () => {
        if (++gpt > 1) throw limited();
        return 'gpt';
      },
    },
  );
  assert.equal(await router.step([], { signal: signal() }), 'gpt');
  assert.equal(await router.step([], { signal: signal() }), 'recovered');
});
for (const code of [
  'FORBIDDEN',
  'AGENT_SOURCE_UNAVAILABLE',
  'INVALID_AGENT_PLAN',
  'AGENT_TOKEN_BUDGET_EXCEEDED',
])
  test(`does not hide security/source/protocol failure ${code}`, async () => {
    let calls = 0;
    const router = quotaFailover(
      {
        step: async () => {
          throw new ServiceError(403, code);
        },
      },
      {
        step: async () => {
          calls++;
        },
      },
    );
    await assert.rejects(
      router.step([], { signal: signal() }),
      new RegExp(code),
    );
    assert.equal(calls, 0);
  });
test('revocation and cancellation stop failover before exposing evidence', async () => {
  for (const revoked of [true, false]) {
    let calls = 0;
    const controller = new AbortController();
    const router = quotaFailover(
      {
        step: async () => {
          if (!revoked) controller.abort();
          throw limited();
        },
      },
      {
        step: async () => {
          calls++;
        },
      },
    );
    await assert.rejects(
      router.step([], {
        signal: controller.signal,
        beforeRetry: async () => {
          throw new ServiceError(403, 'FORBIDDEN');
        },
      }),
    );
    assert.equal(calls, 0);
  }
});
test('routing wrappers never share active-provider state between accounts', async () => {
  const a = {
    model: 'groq',
    step: async () => {
      throw limited();
    },
  };
  const b = { model: 'gpt', step: async () => 'ok' };
  const first = quotaFailover(a, b),
    second = quotaFailover(a, b);
  await first.step([], { signal: signal() });
  assert.equal(first.model, 'gpt');
  assert.equal(second.model, 'groq');
});
test('hybrid selection opts in only through trusted orchestration options', () => {
  const transport = { fetch: async () => {} };
  const c = dataAgentConfiguration(
    {
      ASSISTANT_AGENT_ENABLED: 'true',
      ASSISTANT_DATA_POLICY: 'authorized-erp-results',
      ASSISTANT_MODEL_PROVIDER: 'hybrid',
      ASSISTANT_GROQ_EGRESS: 'germany-proxy',
      NODE_USE_ENV_PROXY: '1',
      HTTPS_PROXY: 'http://127.0.0.1:4310',
    },
    { transport, openaiTransport: transport },
  );
  const simple = { message: 'سلام', history: [] };
  assert.equal(c.selectProvider(simple), c.provider);
  assert.notEqual(
    c.selectProvider(simple, { consumptionExempt: true }),
    c.provider,
  );
  assert.equal(
    c.selectProvider({ ...simple, consumptionExempt: true }),
    c.provider,
  );
  assert.throws(
    () =>
      validateDataAgentMessage({
        version: 1,
        ...simple,
        consumptionExempt: true,
      }),
    /INVALID_MESSAGE/,
  );
});
test('trusted attempt policy permits provider calls after ordinary attempt budget; ordinary budget stays enforced', async () => {
  let calls = 0;
  const pool = createGroqKeyPool({
    entries: [
      { id: 'synthetic', apiKey: 'synthetic', organization: 'synthetic' },
    ],
    fetcher: async () => {
      calls++;
      return new Response('ok');
    },
  });
  const init = {
    method: 'POST',
    redirect: 'error',
    body: '{}',
    signal: signal(),
  };
  await assert.rejects(
    pool.fetch('https://api.groq.com/openai/v1/chat/completions', init, {
      attemptBudget: { attempts: 8, retryTokens: 0 },
    }),
    /AGENT_MODEL_BUDGET_EXCEEDED/,
  );
  assert.equal(
    (
      await pool.fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        init,
        {
          attemptBudget: {
            attempts: 8,
            retryTokens: 0,
            maxAttempts: Number.MAX_SAFE_INTEGER,
          },
        },
      )
    ).status,
    200,
  );
  assert.equal(calls, 1);
});
