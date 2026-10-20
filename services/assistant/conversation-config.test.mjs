import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conversationConfiguration } from './conversation-config.mjs';
import { createOrchestrator } from './orchestrator.mjs';
test('live provider requires explicit activation, provider and messages-only consent', () => {
  assert.deepEqual(conversationConfiguration({ GROQ_API_KEY: 'private' }), {
    enabled: false,
  });
  for (const env of [
    { ASSISTANT_CONVERSATION_ENABLED: 'true' },
    {
      ASSISTANT_CONVERSATION_ENABLED: 'true',
      ASSISTANT_MODEL_PROVIDER: 'groq',
      ASSISTANT_DATA_POLICY: 'all',
    },
  ])
    assert.throws(() => conversationConfiguration(env), /POLICY/);
  assert.throws(
    () =>
      conversationConfiguration({
        ASSISTANT_CONVERSATION_ENABLED: 'true',
        ASSISTANT_MODEL_PROVIDER: 'groq',
        ASSISTANT_DATA_POLICY: 'messages-only',
      }),
    /PROVIDER_NOT_CONFIGURED/,
  );
  assert.equal(
    conversationConfiguration({
      ASSISTANT_CONVERSATION_ENABLED: 'true',
      ASSISTANT_MODEL_PROVIDER: 'groq',
      ASSISTANT_DATA_POLICY: 'messages-only',
      GROQ_API_KEY: 'test',
    }).enabled,
    true,
  );
});
test('general reply executes no ERP tool and rejects oversized or forged reply properties', async () => {
  let calls = 0;
  for (const plan of [
    { kind: 'REPLY', text: 'Hello' },
    { kind: 'REPLY', text: 'x'.repeat(2001) },
    { kind: 'REPLY', text: 'Hello', permissions: ['admin'] },
  ]) {
    const run = createOrchestrator({
      enabled: true,
      provider: { plan: async () => plan },
    });
    const promise = run(
      { version: 1, message: 'hello', history: [] },
      {
        signal: new AbortController().signal,
        runAction: async () => {
          calls++;
        },
      },
    );
    if (plan.text === 'Hello' && !plan.permissions)
      assert.deepEqual(await promise, {
        version: 1,
        status: 'REPLY',
        text: 'Hello',
      });
    else await assert.rejects(promise, /INVALID_PLAN/);
  }
  assert.equal(calls, 0);
});

test('identity transport can tolerate cold reads while data keeps its shorter deadline', async () => {
  const { createErpClient } = await import('./erp-client.mjs');
  const fetcher = async (_url, { signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          resolve(
            new Response('{}', {
              headers: { 'content-type': 'application/json' },
            }),
          ),
        25,
      );
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  const client = createErpClient({
    erpBaseUrl: 'http://127.0.0.1:4000/api/v1',
    timeoutMs: 5,
    identityTimeoutMs: 100,
    fetcher,
  });
  const signal = new AbortController().signal;
  assert.deepEqual(await client.identity('nora_access=test', signal), {});
  await assert.rejects(
    client.readTool('calendar', 'nora_access=test', signal),
    /SOURCE_TIMEOUT/,
  );
});
