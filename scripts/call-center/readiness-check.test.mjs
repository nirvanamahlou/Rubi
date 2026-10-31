import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check } from './readiness-check.mjs';

function requestFor(patch = {}, health = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    if (!options.headers.cookie) return new Response('', { status: 401 });
    return Response.json(
      url.endsWith('/health')
        ? {
            state: 'NO_INTERNAL_ALERT',
            alerts: [],
            ...health,
          }
        : {
            state: 'CONNECTED',
            eventCoverage: 'LIVE_ONLY',
            popupDeliveryEnabled: false,
            pendingFrames: 0,
            continuity: { reconciliationRequired: false, lastGapAt: null },
            ...patch,
          },
    );
  };
}
const env = { TELEPHONY_CHECK_COOKIE: 'test-only-session' };
test('requires provider and backlog health, without claiming live acceptance', async () => {
  const result = await check(env, requestFor());
  assert.equal(result.operationalReady, true);
  assert.equal(result.liveAcceptance, 'NOT_DETERMINED_BY_HEALTH_CHECK');
  assert.equal(result.provider.popupDeliveryEnabled, false);
  assert.ok(!JSON.stringify(result).includes(env.TELEPHONY_CHECK_COOKIE));
});
test('disconnection, unknown provider, gaps and backlog cannot be healthy', async () => {
  for (const patch of [
    { state: 'NOT_CONNECTED' },
    { state: 'NOT_CONFIGURED' },
    { eventCoverage: 'GAP' },
    { continuity: null },
    { continuity: { reconciliationRequired: true } },
  ])
    assert.equal((await check(env, requestFor(patch))).operationalReady, false);
  assert.equal(
    (await check(env, requestFor({}, { alerts: ['DEAD_LETTER'] })))
      .operationalReady,
    false,
  );
});
test('missing or expired authentication is not operational acceptance', async () => {
  assert.equal((await check({}, requestFor())).operationalReady, false);
  assert.equal(
    (await check(env, async () => new Response('', { status: 401 })))
      .operationalReady,
    false,
  );
});
test('refuses credential-bearing URLs and public plaintext', async () => {
  for (const url of [
    'http://example.com',
    'https://user:secret@example.com',
    'https://example.com/?secret=x',
  ])
    await assert.rejects(check({ TELEPHONY_CHECK_API_URL: url }, requestFor()));
});
