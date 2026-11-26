import test from 'node:test';
import assert from 'node:assert/strict';
import { openaiChatRequest } from './openai-responses.mjs';

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
    tools: [],
    tool_choice: 'auto',
    max_completion_tokens: 2048,
  });
  assert.deepEqual(request.messages, messages);
  assert.equal(request.model, 'gpt-6.1-sol');
  assert.equal(request.store, false);
  assert.equal(request.parallel_tool_calls, false);
  assert.equal(request.reasoning_effort, 'medium');
});
