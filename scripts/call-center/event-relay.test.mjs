import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enqueue, flush } from './event-relay.mjs';

async function fixture(run) {
  const dir = await mkdtemp(join(tmpdir(), 'telephony-relay-'));
  const env = {
    TELEPHONY_SPOOL_DIRECTORY: dir,
    TELEPHONY_SPOOL_KEY_BASE64: Buffer.alloc(32, 9).toString('base64'),
    TELEPHONY_SPOOL_RETENTION_DAYS: '7',
    TELEPHONY_RELAY_CONNECTION_ID: '11111111-1111-4111-8111-111111111111',
    TELEPHONY_RELAY_API_URL:
      'http://127.0.0.1/api/v1/internal/telephony-relay/events',
    TELEPHONY_RELAY_SECRET: 's'.repeat(40),
  };
  const event = {
    schemaVersion: 1,
    connectionId: env.TELEPHONY_RELAY_CONNECTION_ID,
    externalEventId: 'test-event',
    caller: '+12025550123',
  };
  try {
    await run(env, event);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const receipt = () =>
  new Response(
    JSON.stringify({
      id: '22222222-2222-4222-8222-222222222222',
      duplicate: false,
    }),
    { status: 201 },
  );
test('encrypted spool survives restart/outage, deduplicates and deletes only after a durable receipt', () =>
  fixture(async (env, event) => {
    assert.equal((await enqueue(event, env)).duplicate, false);
    assert.equal((await enqueue(event, env)).duplicate, true);
    await assert.rejects(
      enqueue({ ...event, caller: 'different' }, env),
      /conflict/,
    );
    const names = await readdir(env.TELEPHONY_SPOOL_DIRECTORY);
    assert.equal(names.length, 1);
    assert.equal(
      (
        await readFile(join(env.TELEPHONY_SPOOL_DIRECTORY, names[0]), 'utf8')
      ).includes('+12025550123'),
      false,
    );
    assert.equal(
      (
        await flush(env, async () => {
          throw Error('offline');
        })
      ).pending,
      1,
    );
    assert.equal((await readdir(env.TELEPHONY_SPOOL_DIRECTORY)).length, 1);
    await assert.rejects(
      flush(env, async () => new Response('{}')),
      /durable receipt/,
    );
    assert.equal(
      (
        await flush(env, async (_url, init) => {
          assert.equal(init.redirect, 'error');
          assert.deepEqual(JSON.parse(init.body), event);
          return receipt();
        })
      ).sent,
      1,
    );
    assert.equal((await readdir(env.TELEPHONY_SPOOL_DIRECTORY)).length, 0);
  }));
test('permanent rejects remain encrypted for review, transient/rate/auth failures remain pending', () =>
  fixture(async (env, event) => {
    await enqueue(event, env);
    for (const status of [429, 503, 401, 403])
      assert.equal(
        (await flush(env, async () => new Response('', { status }))).pending,
        1,
      );
    assert.equal(
      (await flush(env, async () => new Response('', { status: 409 })))
        .rejected,
      1,
    );
    assert.ok(
      (await readdir(env.TELEPHONY_SPOOL_DIRECTORY))[0].endsWith('.dead'),
    );
    await assert.rejects(enqueue(event, env), /operator review/);
  }));
test('invalid connection, oversized payload, missing key and non-private transport fail closed', () =>
  fixture(async (env, event) => {
    await assert.rejects(enqueue({ ...event, connectionId: 'other' }, env));
    await assert.rejects(enqueue({ ...event, raw: 'x'.repeat(17000) }, env));
    await assert.rejects(
      enqueue(event, { ...env, TELEPHONY_SPOOL_KEY_BASE64: '' }),
    );
    await assert.rejects(
      flush({
        ...env,
        TELEPHONY_RELAY_API_URL:
          'http://example.invalid/api/v1/internal/telephony-relay/events',
      }),
    );
  }));
test('concurrent publishers preserve one immutable event', () =>
  fixture(async (env, event) => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => enqueue(event, env)),
    );
    assert.equal(results.filter((r) => !r.duplicate).length, 1);
    assert.equal((await readdir(env.TELEPHONY_SPOOL_DIRECTORY)).length, 1);
  }));

test('pending private payload expires under the explicit retention policy without being delivered', () =>
  fixture(async (env, event) => {
    await enqueue(event, { ...env, TELEPHONY_SPOOL_RETENTION_DAYS: '1' });
    const now = Date.now;
    Date.now = () => now() + 2 * 86400000;
    try {
      const result = await flush(env, async () => {
        throw Error('Expired data must not be sent');
      });
      assert.equal(result.rejected, 1);
      assert.equal((await readdir(env.TELEPHONY_SPOOL_DIRECTORY)).length, 0);
    } finally {
      Date.now = now;
    }
  }));
