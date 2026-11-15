import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentProvider } from './agent-provider.mjs';

const options = () => ({ signal: new AbortController().signal });
test('429 respects Retry-After, suppresses repeated calls, and permits a later request', async () => {
  let clock = 100000,
    calls = 0;
  const provider = createAgentProvider({
    apiKey: 'synthetic',
    now: () => clock,
    fetcher: async () => {
      calls++;
      return new Response('{}', {
        status: 429,
        headers: { 'retry-after': '2' },
      });
    },
  });
  await assert.rejects(
    provider.step([], options()),
    /AGENT_PROVIDER_RATE_LIMITED/,
  );
  clock += 1999;
  await assert.rejects(
    provider.step([], options()),
    /AGENT_PROVIDER_RATE_LIMITED/,
  );
  assert.equal(calls, 1);
  clock += 1;
  await assert.rejects(
    provider.step([], options()),
    /AGENT_PROVIDER_RATE_LIMITED/,
  );
  assert.equal(calls, 2);
});
for (const header of [undefined, 'invalid', '-1'])
  test(`invalid/missing Retry-After uses bounded cooldown: ${header}`, async () => {
    let calls = 0;
    const provider = createAgentProvider({
      apiKey: 'synthetic',
      fetcher: async () => {
        calls++;
        return new Response('{}', {
          status: 429,
          headers: header ? { 'retry-after': header } : {},
        });
      },
    });
    for (let i = 0; i < 2; i++)
      await assert.rejects(
        provider.step([], options()),
        /AGENT_PROVIDER_RATE_LIMITED/,
      );
    assert.equal(calls, 1);
  });
for (const [status, code] of [
  [400, 'REQUEST_REJECTED'],
  [401, 'ACCESS_DENIED'],
  [403, 'ACCESS_DENIED'],
  [500, 'UNAVAILABLE'],
  [503, 'UNAVAILABLE'],
])
  test(`provider ${status} is classified without retry`, async () => {
    let calls = 0;
    const provider = createAgentProvider({
      apiKey: 'synthetic',
      fetcher: async () => {
        calls++;
        return new Response('{}', { status });
      },
    });
    await assert.rejects(
      provider.step([], options()),
      new RegExp('AGENT_PROVIDER_' + code),
    );
    assert.equal(calls, 1);
  });
test('network failure remains controlled and does not retry', async () => {
  let calls = 0;
  const provider = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async () => {
      calls++;
      throw new Error('synthetic transport failure');
    },
  });
  await assert.rejects(
    provider.step([], options()),
    /AGENT_PROVIDER_UNAVAILABLE/,
  );
  assert.equal(calls, 1);
});
