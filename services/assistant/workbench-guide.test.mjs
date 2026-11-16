import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkbenchGuideSelector,
  validateWorkbenchGuide,
  workbenchGuideConfiguration,
} from './workbench-guide.mjs';
import { createAssistantServer } from './server.mjs';
const input = { version: 1, topicId: 'leave', goal: 'steps' };
test('guide inputs exclude arbitrary text, employee records, URLs and SQL', () => {
  assert.deepEqual(validateWorkbenchGuide(input), input);
  for (const value of [
    { ...input, message: 'secret' },
    { ...input, topicId: '../secret' },
    { ...input, goal: 'SELECT *' },
    null,
  ])
    assert.throws(() => validateWorkbenchGuide(value));
});
test('native tool selection is one bounded call and cannot author the answer', async () => {
  let calls = 0;
  const select = createWorkbenchGuideSelector({
    apiKey: 'synthetic',
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(options.redirect, 'error');
      const body = JSON.parse(options.body);
      assert.equal(body.tools[0].function.name, 'workbench_guide');
      assert.equal(body.tool_choice, 'auto');
      assert.deepEqual(JSON.parse(body.messages[1].content), input);
      return Response.json({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: 'workbench_guide',
                    arguments: JSON.stringify({
                      topicId: 'leave',
                      goal: 'steps',
                    }),
                  },
                },
              ],
            },
          },
        ],
      });
    },
  });
  assert.equal(
    (await select(input, new AbortController().signal)).selection,
    'model',
  );
  assert.equal(calls, 1);
});
test('quota cooldown avoids spending another model call and preserves internal guidance', async () => {
  let calls = 0,
    time = 0;
  const select = createWorkbenchGuideSelector({
    apiKey: 'synthetic',
    now: () => time,
    fetcher: async () => {
      calls++;
      return new Response(null, {
        status: 429,
        headers: { 'retry-after': '600' },
      });
    },
  });
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await select(input, new AbortController().signal)).selection,
      'internal',
    );
  assert.equal(calls, 1);
  time = 601000;
  await select(input, new AbortController().signal);
  assert.equal(calls, 2);
});
test('invalid model tool, text, outage and unconfigured selector all fall back without executing anything', async () => {
  for (const payload of [
    {},
    { choices: [{ message: { content: 'write data' } }] },
    {
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: 'database_query', arguments: '{}' } },
            ],
          },
        },
      ],
    },
  ]) {
    const select = createWorkbenchGuideSelector({
      apiKey: 'synthetic',
      fetcher: async () => Response.json(payload),
    });
    assert.equal(
      (await select(input, new AbortController().signal)).selection,
      'internal',
    );
  }
  assert.equal(
    (await createWorkbenchGuideSelector()(input, new AbortController().signal))
      .selection,
    'internal',
  );
  assert.deepEqual(workbenchGuideConfiguration({}), {});
  assert.throws(
    () =>
      workbenchGuideConfiguration({
        ASSISTANT_AGENT_ENABLED: 'true',
        ASSISTANT_DATA_POLICY: 'authorized-erp-results',
        ASSISTANT_MODEL_PROVIDER: 'groq',
      }),
    /PROXY/,
  );
});
test('guide HTTP endpoint authenticates before selection and revalidates session afterwards', async (t) => {
  let auth = 0,
    model = 0;
  const server = createAssistantServer({
    erpBaseUrl: 'http://127.0.0.1:4000/api/v1',
    fetcher: async () => {
      auth++;
      return Response.json({
        userId: auth === 4 ? 'different-user' : 'test',
        permissions: [],
        branchIds: [],
      });
    },
    audit: () => {},
    workbenchGuide: {
      apiKey: 'synthetic',
      fetcher: async () => {
        model++;
        return new Response(null, { status: 429 });
      },
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/v1/assistant/workbench-guide`;
  const request = (cookie) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(input),
    });
  assert.equal((await request()).status, 401);
  assert.equal(model, 0);
  assert.equal(auth, 0);
  const success = await request('nora_access=synthetic');
  assert.equal(success.status, 200);
  assert.equal((await success.json()).selection, 'internal');
  assert.equal(auth, 2);
  assert.equal(model, 1);
  assert.equal((await request('nora_access=synthetic')).status, 403);
});
