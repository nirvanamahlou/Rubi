import test from 'node:test';
import assert from 'node:assert/strict';
import { openaiChatRequest, openaiToolSelection } from './openai-responses.mjs';

test('Sol receives matching tool call IDs and only the authorized tool result', () => {
  const messages = [
    { role: 'user', content: 'Count records' },
    {
      role: 'assistant',
      tool_calls: [
        {
          id: 'call_lookup',
          type: 'function',
          function: { name: 'lookup', arguments: '{}' },
        },
      ],
    },
    { role: 'tool', tool_call_id: 'call_lookup', content: '{"count":12}' },
  ];
  const request = openaiChatRequest({
    messages,
    tools: [
      {
        type: 'function',
        function: {
          name: 'lookup',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: 'auto',
    max_completion_tokens: 2048,
  });
  assert.deepEqual(request.messages, messages);
  assert.equal(request.model, 'gpt-6.1-sol');
  assert.equal(request.store, false);
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(request.reasoning_effort, 'medium');
});

test('truncated, refused and unoffered selections cannot become tool calls', () => {
  const tools = [{ function: { name: 'lookup' } }];
  const content = JSON.stringify({ call: { name: 'lookup', arguments: {} } });
  for (const [finish_reason, message] of [
    ['length', { content }],
    ['stop', { content, refusal: 'unavailable' }],
    ['stop', { content: content.replace('lookup', 'other') }],
    ['stop', { content: '?' }],
  ]) {
    assert.deepEqual(
      openaiToolSelection({ choices: [{ finish_reason, message }] }, tools),
      {},
    );
  }
});
