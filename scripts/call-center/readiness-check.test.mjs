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
            pending: 0,
            retrying: 0,
            dead: 0,
            unpublishedRecordings: 0,
            unknownCommands: 0,
            expiredRecordings: 0,
            oldestPendingSeconds: null,
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

test('incomplete or contradictory health cannot silently pass', async () => {
  const fields = [
    'pending',
    'retrying',
    'dead',
    'unpublishedRecordings',
    'unknownCommands',
    'expiredRecordings',
  ];
  for (const field of fields) {
    for (const value of [
      undefined,
      null,
      -1,
      0.5,
      '0',
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      assert.equal(
        (await check(env, requestFor({}, { [field]: value }))).operationalReady,
        false,
        `${field}=${String(value)}`,
      );
    }
  }
  for (const field of [
    'dead',
    'unpublishedRecordings',
    'unknownCommands',
    'expiredRecordings',
  ])
    assert.equal(
      (await check(env, requestFor({}, { [field]: 1 }))).operationalReady,
      false,
    );
  for (const patch of [
    { pending: 1 },
    { retrying: 1, oldestPendingSeconds: 60 },
    { pending: 1, oldestPendingSeconds: -1 },
    { oldestPendingSeconds: 0 },
  ])
    assert.equal(
      (await check(env, requestFor({}, patch))).operationalReady,
      false,
    );
  assert.equal(
    (await check(env, requestFor({}, { pending: 1, oldestPendingSeconds: 59 })))
      .operationalReady,
    true,
  );
});

test('unknown frame backlog cannot pass, while healthy transient work is allowed', async () => {
  for (const value of [undefined, null, -1, 0.5, '0'])
    assert.equal(
      (await check(env, requestFor({ pendingFrames: value }))).operationalReady,
      false,
    );
  assert.equal(
    (await check(env, requestFor({ pendingFrames: 1 }))).operationalReady,
    true,
  );
});
