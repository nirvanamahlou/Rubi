import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantServer } from './server.mjs';
import {
  validatedQuestionParts,
  validatePlanningRequest,
  planQuestionParts,
} from './question-plan.mjs';

const parts = ['فهرست خریدهای تهران رو بده', 'راهنمای ثبت مرخصی کجاست'];
const message = parts.join(' و ') + '؟';
const input = { version: 1, message, history: [] };

test('only ordered fully covered source clauses are eligible', () => {
  assert.deepEqual(validatedQuestionParts(message, parts), parts);
  assert.deepEqual(
    validatedQuestionParts(parts.join('؟ ') + '؟', parts),
    parts,
  );
  for (const proposal of [
    [parts[1], parts[0]],
    ['لیست خریدها رو بده', parts[1]],
    [parts[0].replace(' تهران', ''), parts[1]],
    [parts[0]],
    [parts[1], parts[1]],
    ['فهرست خریدهای', 'راهنمای ثبت مرخصی کجاست'],
  ])
    assert.deepEqual(validatedQuestionParts(message, proposal), []);
  assert.deepEqual(
    validatedQuestionParts(message + ' فقط شعبه تهران', parts),
    [],
  );
  assert.deepEqual(
    validatedQuestionParts(message.replace(' و ', ' به جز '), parts),
    [],
  );
  const dependent = ['صورت فروش را بده', 'فهرست همان دوره را بده'];
  assert.deepEqual(
    validatedQuestionParts(dependent.join(' و '), dependent),
    [],
  );
  assert.throws(
    () =>
      validatePlanningRequest({
        ...input,
        history: [{ role: 'user', content: 'private' }],
      }),
    /INVALID_MESSAGE/,
  );
  assert.throws(
    () => validatePlanningRequest({ ...input, scope: 'all' }),
    /INVALID_MESSAGE/,
  );
});

test('disabled or simple question costs no model turns; charges are bounded', async () => {
  let calls = 0;
  const agent = {
    enabled: true,
    provider: {
      step: async () => {
        calls++;
        return { name: 'set_plan', args: { steps: parts }, tokens: 25000 };
      },
    },
  };
  const opts = { agent, signal: new AbortController().signal, audit: () => {} };
  for (const [question, enabled] of [
    [input, false],
    [{ ...input, message: parts[1] }, true],
  ]) {
    assert.deepEqual(await planQuestionParts(question, { ...opts, enabled }), {
      version: 1,
      parts: [],
    });
  }
  assert.equal(calls, 0);
  await assert.rejects(
    planQuestionParts(input, { ...opts, enabled: true }),
    /AGENT_TOKEN_BUDGET_EXCEEDED/,
  );
  assert.equal(calls, 1);
});

test('HTTP planner authenticates before the provider and on release and shares ordinary quotas', async (t) => {
  let actor = 'synthetic',
    revoke = false,
    calls = 0;
  const audit = [];
  const service = createAssistantServer({
    erpBaseUrl: 'http://localhost:4000/api/v1',
    modelPlannerEnabled: true,
    rateLimitExemptUserIds: [],
    audit: (event) => audit.push(event),
    fetcher: async (url, init) => {
      assert.ok(url.endsWith('/iam/auth/access'));
      assert.equal(init.headers.cookie, 'nora_access=demo');
      return Response.json({ userId: actor, permissions: [], branchIds: [] });
    },
    agent: {
      enabled: true,
      provider: {
        model: 'test',
        step: async (messages, opts) => {
          calls++;
          assert.deepEqual(opts.allowedTools, ['set_plan']);
          assert.equal(opts.attemptBudget.maxAttempts, 2);
          assert.equal(messages.at(-1).content, message);
          assert.deepEqual(
            messages.map((m) => m.role),
            ['system', 'user'],
          );
          await opts.beforeRetry();
          if (revoke) actor = 'other';
          return { name: 'set_plan', args: { steps: parts }, tokens: 300 };
        },
      },
    },
  });
  await new Promise((resolve, reject) => {
    service.once('error', reject);
    service.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    service.closeAllConnections();
    await new Promise((resolve) => service.close(resolve));
  });
  const send = (cookie, body = input) =>
    fetch('http://127.0.0.1:' + service.address().port + '/v3/assistant/plan', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  assert.equal((await send()).status, 401);
  assert.equal(calls, 0);
  const ok = await send('nora_access=demo; other=private');
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { version: 1, parts });
  assert.ok(!JSON.stringify(audit).includes(parts[0]));
  revoke = true;
  assert.equal((await send('nora_access=demo')).status, 403);
  revoke = false;
  actor = 'synthetic';
  for (let i = 2; i < 12; i++)
    assert.equal((await send('nora_access=demo')).status, 200);
  assert.equal((await send('nora_access=demo')).status, 429);
  assert.equal(calls, 12);
});
