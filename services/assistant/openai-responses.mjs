export const OPENAI_MODEL = 'gpt-6.2-sol';
export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';

export function responsesRequest(body, effort = 'medium') {
  const input = body.messages.flatMap((message) => {
    if (message.role === 'tool') {
      return [
        {
          type: 'function_call_output',
          call_id: message.tool_call_id,
          output: message.content,
        },
      ];
    }
    const items = message.content
      ? [{ role: message.role, content: message.content }]
      : [];
    for (const call of message.tool_calls ?? []) {
      items.push({
        type: 'function_call',
        call_id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      });
    }
    return items;
  });
  const schema = body.response_format?.json_schema;
  return {
    model: OPENAI_MODEL,
    input,
    store: false,
    reasoning: { effort },
    max_output_tokens: body.max_completion_tokens,
    ...(schema
      ? { text: { format: { type: 'json_schema', ...schema } } }
      : {
          tools: body.tools.map(({ function: definition }) => ({
            type: 'function',
            ...definition,
            strict: definition.strict ?? false,
          })),
          tool_choice:
            typeof body.tool_choice === 'string'
              ? body.tool_choice
              : { type: 'function', name: body.tool_choice.function.name },
          parallel_tool_calls: false,
        }),
  };
}

// Translate only completed, recognized outputs into the existing validators.
export function responsesResult(result) {
  const output = result?.output;
  if (result?.status !== 'completed' || !Array.isArray(output)) return {};
  const calls = [];
  const texts = [];
  for (const item of output) {
    if (item.type === 'reasoning') continue;
    if (item.type === 'function_call' && item.status === 'completed') {
      calls.push({
        id: item.call_id,
        type: 'function',
        function: { name: item.name, arguments: item.arguments },
      });
    } else if (
      item.type === 'message' &&
      item.role === 'assistant' &&
      item.status === 'completed' &&
      Array.isArray(item.content) &&
      item.content.every(
        (part) => part.type === 'output_text' && typeof part.text === 'string',
      )
    ) {
      texts.push(...item.content.map((part) => part.text));
    } else {
      return {};
    }
  }
  const usage = result.usage;
  return {
    choices: [
      {
        finish_reason: calls.length ? 'tool_calls' : 'stop',
        message: { content: texts.join(''), tool_calls: calls },
      },
    ],
    usage: {
      total_tokens: usage?.total_tokens,
      prompt_tokens: usage?.input_tokens,
      completion_tokens: usage?.output_tokens,
      prompt_tokens_details: usage?.input_tokens_details,
      completion_tokens_details: usage?.output_tokens_details,
    },
  };
}
