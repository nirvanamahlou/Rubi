import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentProvider } from './agent-provider.mjs';
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
