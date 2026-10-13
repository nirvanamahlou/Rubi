import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToolExecutor } from './tool-executor.mjs';
import { createErpClient } from './erp-client.mjs';
import { recordRequestAudit } from './audit.mjs';
import { ServiceError } from './errors.mjs';

const signal = () => new AbortController().signal;
const context = () => ({
  cookie: 'nora_access=synthetic',
  signal: signal(),
  actorId: 'a',
});
const principal = { userId: 'a', permissions: [], branchIds: ['branch-a'] };

test('executor validates before any identity or source call and denies corporate data', async () => {
  let identities = 0,
    reads = 0;
  const execute = createToolExecutor({
    authenticate: async () => {
      identities++;
      return principal;
    },
    client: {
      readTool: async () => {
        reads++;
        return {};
      },
    },
  });
  await assert.rejects(execute('shell', {}, context()), {
    message: 'UNKNOWN_TOOL',
  });
  await assert.rejects(execute('calendar', { userId: 'b' }, context()), {
    message: 'INVALID_TOOL_INPUT',
  });
  assert.equal(identities, 0);
  await assert.rejects(execute('sales.weekly', {}, context()), {
    message: 'FORBIDDEN',
  });
  assert.equal(reads, 0);
});

test('executor preserves identity context, sanitizes results and records only tool outcome', async () => {
  const calls = [],
    outcomes = [];
  const execute = createToolExecutor({
    authenticate: async (...args) => {
      calls.push(args);
      return principal;
    },
    client: {
      readTool: async (id, cookie) => {
        assert.equal(id, 'calendar');
        assert.equal(cookie, 'nora_access=synthetic');
        return { data: [], secret: 'must-not-leak' };
      },
    },
  });
  assert.deepEqual(
    await execute(
      'calendar',
      {},
      { ...context(), record: (e) => outcomes.push(e) },
    ),
    { followUps: [], truncated: false },
  );
  assert.equal(calls[0][2], 'a');
  assert.equal(calls[0][3], 'calendar');
  assert.deepEqual(outcomes, [{ tool: 'calendar', outcome: 'SUCCESS' }]);
});

test('executor rejects invalid body and propagates denial or timeout without retry', async () => {
  for (const response of [
    { data: [{}] },
    { wrong: [] },
    new ServiceError(403, 'FORBIDDEN'),
    new ServiceError(502, 'SOURCE_TIMEOUT'),
  ]) {
    let reads = 0;
    const outcomes = [];
    const execute = createToolExecutor({
      authenticate: async () => principal,
      client: {
        readTool: async () => {
          reads++;
          if (response instanceof Error) throw response;
          return response;
        },
      },
    });
    await assert.rejects(
      execute(
        'calendar',
        {},
        { ...context(), record: (e) => outcomes.push(e) },
      ),
    );
    assert.equal(reads, 1);
    assert.equal(
      outcomes[0].outcome,
      response.status === 403 ? 'DENIED' : 'FAILED',
    );
  }
});

test('aborted requests cannot start a tool', async () => {
  const abort = new AbortController();
  abort.abort();
  const execute = createToolExecutor({
    authenticate: async () => assert.fail('unexpected auth'),
    client: {},
  });
  await assert.rejects(
    execute('calendar', {}, { ...context(), signal: abort.signal }),
    { message: 'SOURCE_TIMEOUT' },
  );
});

test('executor withholds output when session, grant or branch is revoked during a read', async () => {
  for (const revoked of [
    new ServiceError(401, 'UNAUTHENTICATED'),
    { ...principal, branchIds: [] },
    { ...principal, permissions: [] },
  ]) {
    let count = 0;
    const outcomes = [];
    const execute = createToolExecutor({
      authenticate: async () => {
        count++;
        if (count === 1) return principal;
        if (revoked instanceof Error) throw revoked;
        // Personal access is independently checked by IAM, not a local grant.
        if (revoked.branchIds.length) throw new ServiceError(403, 'FORBIDDEN');
        return revoked;
      },
      client: { readTool: async () => ({ data: [] }) },
    });
    await assert.rejects(
      execute(
        'calendar',
        {},
        { ...context(), record: (e) => outcomes.push(e) },
      ),
    );
    assert.equal(count, 2);
    assert.equal(outcomes[0].outcome, 'DENIED');
  }
});

test('ERP transport permits only registry routes and configured bases', async () => {
  const calls = [];
  const client = createErpClient({
    erpBaseUrl: 'http://127.0.0.1:4000/api/v1',
    erpReportsBaseUrl: 'http://127.0.0.1:4301/api/v1',
    erpAuthBaseUrl: 'http://127.0.0.1:4301/api/v1',
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json({});
    },
  });
  assert.throws(() => client.readTool('/sql', 'cookie', signal()), {
    message: 'UNKNOWN_TOOL',
  });
  assert.throws(() => client.identity('cookie', signal(), 'sales.weekly'), {
    message: 'INVALID_TOOL_INPUT',
  });
  await client.readTool('calendar', 'nora_access=synthetic', signal());
  await client.readTool('sales.weekly', 'nora_access=synthetic', signal());
  await client.identity('nora_access=synthetic', signal(), 'calendar');
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      'http://127.0.0.1:4000/api/v1/workbench/calendar',
      'http://127.0.0.1:4301/api/v1/sales/assistant/weekly',
      'http://127.0.0.1:4301/api/v1/iam/auth/access',
    ],
  );
  for (const { options } of calls) {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.body, undefined);
  }
});

test('ERP body cap and safe failure classifications survive extraction', async () => {
  for (const [response, code] of [
    [new Response('x'.repeat(524289)), 'SOURCE_TOO_LARGE'],
    [new Response('{}', { status: 404 }), 'SOURCE_NOT_CONNECTED'],
    [
      Response.json({ message: 'SALES_SOURCE_CAP_EXCEEDED' }, { status: 409 }),
      'SOURCE_CAP_EXCEEDED',
    ],
    [new Response('private failure', { status: 500 }), 'SOURCE_UNAVAILABLE'],
    [new Response('{}', { status: 401 }), 'UNAUTHENTICATED'],
  ]) {
    const client = createErpClient({
      erpBaseUrl: 'http://127.0.0.1/api/v1',
      fetcher: async () => response,
    });
    await assert.rejects(client.readTool('calendar', 'cookie', signal()), {
      message: code,
    });
  }
});

test('audit discards unapproved fields and tolerates sink failure', () => {
  const events = [];
  const event = {
    correlationId: 'request-1',
    actorId: 'a',
    at: '2026-10-13T08:00:00Z',
    outcome: 'SUCCESS',
    durationMs: 12,
    action: 'daily-summary',
    cookie: 'private',
    title: 'private',
    prompt: 'private',
    amount: 'private',
    tools: [
      { tool: 'calendar', outcome: 'SUCCESS', body: 'private' },
      { tool: 'shell', outcome: 'SUCCESS' },
    ],
  };
  recordRequestAudit((value) => events.push(value), event);
  assert.ok(!JSON.stringify(events).includes('private'));
  assert.deepEqual(events[0].tools, [{ tool: 'calendar', outcome: 'SUCCESS' }]);
  assert.doesNotThrow(() =>
    recordRequestAudit(() => {
      throw new Error('sink offline');
    }, event),
  );
});
