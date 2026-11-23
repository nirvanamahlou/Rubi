import test from 'node:test';
import assert from 'node:assert/strict';
import { responsesRequest, responsesResult } from './openai-responses.mjs';

test('Responses carries authorized tool output with the matching call ID', () => {
  const result = responsesResult({
    status: 'completed',
    output: [
      { type: 'reasoning' },
      {
        type: 'function_call',
        status: 'completed',
        id: 'fc_item',
        call_id: 'call_lookup',
        name: 'lookup',
        arguments: '{}',
      },
    ],
    usage: {
      input_tokens: 12,
      output_tokens: 8,
      total_tokens: 20,
      output_tokens_details: { reasoning_tokens: 4 },
    },
  });
  const body = responsesRequest({
    messages: [
      { role: 'user', content: 'Count records' },
      { role: 'assistant', tool_calls: result.choices[0].message.tool_calls },
      { role: 'tool', tool_call_id: 'call_lookup', content: '{"count":12}' },
    ],
    tools: [],
    tool_choice: 'auto',
    max_completion_tokens: 2048,
  });
  assert.deepEqual(body.input.slice(1), [
    {
      type: 'function_call',
      call_id: 'call_lookup',
      name: 'lookup',
      arguments: '{}',
    },
    {
      type: 'function_call_output',
      call_id: 'call_lookup',
      output: '{"count":12}',
    },
  ]);
  assert.equal(result.usage.completion_tokens_details.reasoning_tokens, 4);
  assert.deepEqual(responsesResult({ status: 'incomplete', output: [] }), {});
});
