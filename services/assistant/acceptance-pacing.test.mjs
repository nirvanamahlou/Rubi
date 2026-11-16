import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  acceptanceWaitMs,
  runAcceptanceCases,
} from '../../scripts/operations/nora-agent/acceptance-pacing.mjs';

test('all30 healthy scenarios run immediately in order without initial/success sleeps', async () => {
  const seen = [];
  const waits = [];
  await runAcceptanceCases({
    runCase: async (index) => {
      seen.push(index);
      return { exitCode: 0, tokens: 9000 };
    },
    wait: async (ms) => waits.push(ms),
  });
  assert.deepEqual(
    seen,
    Array.from({ length: 30 }, (_, i) => i + 1),
  );
  assert.deepEqual(waits, []);
  assert.equal(acceptanceWaitMs({ exitCode: 0, tokens: 900000 }), 0);
});

test('actual429 feedback alone schedules retry, without an invented one-hour minimum', async () => {
  const waits = [];
  const calls = [];
  const events = [];
  await runAcceptanceCases({
    runCase: async (index) => {
      calls.push(index);
      return calls.length === 1
        ? {
            error: 'AGENT_PROVIDER_RATE_LIMITED',
            retryAfterMs: 1250,
            exitCode: 1,
          }
        : { exitCode: 0 };
    },
    wait: async (ms) => waits.push(ms),
    onProgress: (event) => events.push(event),
    now: () => 0,
  });
  assert.deepEqual(waits, [1250]);
  assert.deepEqual(calls.slice(0, 3), [1, 1, 2]);
  assert.equal(
    events.find((e) => e.status === 'WAITING_FOR_QUOTA').nextAttemptAt,
    '1970-01-01T00:00:01.250Z',
  );
  assert.equal(
    acceptanceWaitMs({
      error: 'AGENT_PROVIDER_RATE_LIMITED',
      retryAfterMs: 7200000,
    }),
    7200000,
  );
});

test('unknown retry time stops instead of guessing an hour or aggressively retrying', async () => {
  for (const value of [undefined, 0, -1, Infinity, NaN, '60000'])
    assert.throws(
      () =>
        acceptanceWaitMs({
          error: 'AGENT_PROVIDER_RATE_LIMITED',
          retryAfterMs: value,
        }),
      /PROVIDER_RETRY_TIME_REQUIRED/,
    );
  let calls = 0;
  await assert.rejects(
    runAcceptanceCases({
      runCase: async () => {
        calls++;
        return { error: 'AGENT_PROVIDER_RATE_LIMITED' };
      },
      wait: async () => assert.fail('must not wait'),
    }),
    /PROVIDER_RETRY_TIME_REQUIRED/,
  );
  assert.equal(calls, 1);
});

test('real scenario failures never get retried or marked passed', async () => {
  const seen = [];
  await assert.rejects(
    runAcceptanceCases({
      runCase: async (index) => {
        seen.push(index);
        return { exitCode: 1 };
      },
      wait: async () => assert.fail('must not wait'),
    }),
    /SCENARIO_1_FAILED_REVIEW_REQUIRED/,
  );
  assert.deepEqual(seen, [1]);
});

test('exhausted quota retry budget does not perform a final useless sleep', async () => {
  let attempts = 0;
  const waits = [];
  await assert.rejects(
    runAcceptanceCases({
      runCase: async () => {
        attempts++;
        return { error: 'AGENT_PROVIDER_RATE_LIMITED', retryAfterMs: 1000 };
      },
      wait: async (ms) => waits.push(ms),
    }),
    /SCENARIO_1_QUOTA_STILL_UNAVAILABLE/,
  );
  assert.equal(attempts, 6);
  assert.deepEqual(waits, Array(5).fill(1000));
});

test('independent fast runner refuses implicit execution before loading private configuration', () => {
  const runner = fileURLToPath(
    new URL(
      '../../scripts/operations/nora-agent/run-live-acceptance-fast.mjs',
      import.meta.url,
    ),
  );
  const result = spawnSync(process.execPath, [runner], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /EXPLICIT_SYNTHETIC_RUN_REQUIRED/);
});
