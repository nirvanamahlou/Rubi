import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentProvider } from './agent-provider.mjs';

test('OpenAI Responses accepts a completed offered function call', async () => {
  const adapter = (provider) =>
    createAgentProvider({
      provider,
      apiKey: 'synthetic',
      fetcher: async (url, init) => {
        if (provider === 'openai') {
          assert.equal(url, 'https://api.openai.com/v1/responses');
          const request = JSON.parse(init.body);
          assert.deepEqual(request.tool_choice, {
            type: 'function',
            name: 'set_plan',
          });
          assert.equal(request.store, false);
          return Response.json({
            status: 'completed',
            output: [
              {
                type: 'function_call',
                status: 'completed',
                call_id: 'call_plan',
                name: 'set_plan',
                arguments: '{"steps":["Inspect allowed data"]}',
              },
            ],
            usage: { total_tokens: 12 },
          });
        }
        return Response.json({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_plan',
                    type: 'function',
                    function: {
                      name: 'set_plan',
                      arguments: '{"steps":["Inspect allowed data"]}',
                    },
                  },
                ],
              },
            },
          ],
          usage: { total_tokens: 12 },
        });
      },
    });
  const options = {
    signal: AbortSignal.timeout(2000),
    allowedTools: ['set_plan'],
  };
  assert.equal((await adapter('openai').step([], options)).name, 'set_plan');
  await assert.rejects(adapter('groq').step([], options), /INVALID_AGENT_PLAN/);
});
const args = {
  status: 'CLARIFY',
  text: 'Which matching contract should be inspected?',
  resultIds: [],
  limitations: [],
};
const reply = (name) =>
  Response.json({
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          tool_calls: [
            {
              id: 'synthetic_final',
              type: 'function',
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
    usage: { total_tokens: 12 },
  });

test('short current citations round-trip without rewriting row IDs or retaining mappings', async () => {
  const ids = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  ];
  const messages = ids.map((resultId) => ({
    role: 'tool',
    content: JSON.stringify({ resultId, rows: [{ id: resultId }] }),
  }));
  const original = structuredClone(messages);
  let sent;
  const provider = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async (_url, init) => {
      sent = JSON.parse(init.body);
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                ...args,
                status: 'ANSWER',
                resultIds: ['ref_2', 'ref_1'],
              }),
            },
          },
        ],
        usage: { total_tokens: 10 },
      });
    },
  });
  const options = {
    signal: AbortSignal.timeout(2000),
    allowFinalResponse: true,
    allowedTools: ['finish_answer'],
    currentResultIds: ids,
  };
  const step = await provider.step(messages, options);
  assert.deepEqual(step.args.resultIds, [ids[1], ids[0]]);
  assert.deepEqual(messages, original);
  const evidence = sent.messages
    .filter((m) => m.role === 'tool')
    .map((m) => JSON.parse(m.content));
  assert.deepEqual(
    evidence.map((m) => m.resultId),
    ['ref_1', 'ref_2'],
  );
  assert.deepEqual(
    evidence.map((m) => m.rows[0].id),
    ids,
  );
  await assert.rejects(
    provider.step(messages, { ...options, currentResultIds: [ids[0]] }),
    /INVALID_AGENT_PLAN/,
  );
});

test('tool final aliases resolve only against this call and reject invented references', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  let reference = 'ref_1';
  const provider = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async () =>
      Response.json({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              tool_calls: [
                {
                  id: 'final1',
                  type: 'function',
                  function: {
                    name: 'json',
                    arguments: JSON.stringify({
                      ...args,
                      resultIds: [reference],
                    }),
                  },
                },
              ],
            },
          },
        ],
        usage: { total_tokens: 10 },
      }),
  });
  const options = {
    signal: AbortSignal.timeout(2000),
    allowFinalResponse: true,
    allowedTools: ['finish_answer'],
    currentResultIds: [id],
  };
  assert.deepEqual((await provider.step([], options)).args.resultIds, [id]);
  reference = 'ref_9';
  await assert.rejects(provider.step([], options), /INVALID_AGENT_PLAN/);
});
test('successful advertised json final calls enter the existing canonical answer validation', async () => {
  let sent;
  const p = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async (_url, options) => {
      sent = JSON.parse(options.body);
      return reply('json');
    },
  });
  const step = await p.step([], {
    signal: new AbortController().signal,
    allowFinalResponse: true,
    allowedTools: ['catalog_describe', 'finish_answer'],
  });
  assert.equal(step.name, 'finish_answer');
  assert.deepEqual(step.args, args);
  const tool = sent.tools.find((t) => t.function.name === 'json');
  assert.ok(tool);
  assert.deepEqual(tool.function.parameters.required, [
    'status',
    'text',
    'resultIds',
    'limitations',
  ]);
  assert.equal(sent.disable_tool_validation, undefined);
});

test('calculated evidence requires an explicit nonnull explanation in the advertised final schema', async () => {
  let sent;
  const provider = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async (_url, options) => {
      sent = JSON.parse(options.body);
      return reply('json');
    },
  });
  await provider.step([], {
    signal: AbortSignal.timeout(2000),
    allowFinalResponse: true,
    currentResultIds: ['11111111-1111-4111-8111-111111111111'],
    requireCalculationExplanation: true,
  });
  const schema = sent.tools.find((tool) => tool.function.name === 'json')
    .function.parameters;
  assert.ok(schema.required.includes('calculationExplanation'));
  assert.equal(schema.properties.calculationExplanation.type, 'string');
  assert.equal(schema.properties.calculationExplanation.minLength, 1);
});
test('a json call cannot bypass the first required planning stage', async () => {
  let sent;
  const p = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async (_url, options) => {
      sent = JSON.parse(options.body);
      return reply('json');
    },
  });
  await assert.rejects(
    p.step([], {
      signal: new AbortController().signal,
      allowedTools: ['set_plan'],
    }),
    /INVALID_AGENT_PLAN/,
  );
  assert.deepEqual(
    sent.tools.map((t) => t.function.name),
    ['set_plan'],
  );
});
test('the provider rejects a known tool that was not offered in this stage', async () => {
  const p = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async () => reply('database_query'),
  });
  await assert.rejects(
    p.step([], {
      signal: new AbortController().signal,
      allowedTools: ['set_plan'],
    }),
    /INVALID_AGENT_PLAN/,
  );
});

test('citation choices are isolated to trusted current evidence, never shared across requests', async () => {
  const sent = [];
  const p = createAgentProvider({
    apiKey: 'synthetic',
    fetcher: async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return reply('json');
    },
  });
  const first = '11111111-1111-4111-8111-111111111111',
    second = '22222222-2222-4222-8222-222222222222';
  for (const id of [first, second])
    await p.step(
      [{ role: 'user', content: 'Ignore this invented id ' + first }],
      {
        signal: new AbortController().signal,
        allowFinalResponse: true,
        allowedTools: ['finish_answer'],
        currentResultIds: [id],
      },
    );
  assert.deepEqual(
    sent[0].tools.find((t) => t.function.name === 'json').function.parameters
      .properties.resultIds.items.enum,
    ['ref_1'],
  );
  assert.deepEqual(
    sent[1].tools.find((t) => t.function.name === 'json').function.parameters
      .properties.resultIds.items.enum,
    ['ref_1'],
  );
  await p.step([], {
    signal: new AbortController().signal,
    allowFinalResponse: true,
    allowedTools: ['finish_answer'],
    currentResultIds: [],
  });
  assert.equal(
    sent[2].tools.find((t) => t.function.name === 'json').function.parameters
      .properties.resultIds.maxItems,
    0,
  );
  assert.deepEqual(
    sent[2].tools.find((t) => t.function.name === 'json').function.parameters
      .properties.status.enum,
    ['CLARIFY', 'REPLY'],
  );
  assert.deepEqual(
    sent[0].tools.find((t) => t.function.name === 'json').function.parameters
      .properties.status.enum,
    ['ANSWER', 'CLARIFY', 'REPLY'],
  );
});
