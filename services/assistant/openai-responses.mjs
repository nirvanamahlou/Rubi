export const OPENAI_MODEL = 'gpt-6.1-sol';
export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Sol supports strict structured output on this endpoint. Express only the
// tools offered for this step, with the same arguments as the server dispatcher.
function toolSelectionFormat(body) {
  const forced = body.tool_choice?.function?.name;
  const choices = body.tools
    .filter((tool) => !forced || tool.function.name === forced)
    .map(({ function: { name, parameters } }) => ({
      type: 'object',
      properties: {
        name: { type: 'string', enum: [name] },
        arguments: {
          ...parameters,
          required: Object.keys(parameters.properties),
        },
      },
      required: ['name', 'arguments'],
      additionalProperties: false,
    }));
  return {
    type: 'json_schema',
    json_schema: {
      name: 'nora_tool_selection',
      strict: true,
      schema: {
        type: 'object',
        properties: { call: { anyOf: choices } },
        required: ['call'],
        additionalProperties: false,
      },
    },
  };
}

export function openaiChatRequest(body, effort = 'medium') {
  return {
    model: OPENAI_MODEL,
    messages: body.messages,
    max_completion_tokens: body.max_completion_tokens,
    reasoning_effort: effort,
    store: false,
    response_format: body.response_format ?? toolSelectionFormat(body),
  };
}

export function openaiToolSelection(result, offered) {
  const choices = result?.choices;
  if (choices?.length !== 1) return {};
  const [{ finish_reason, message }] = choices;
  if (
    finish_reason !== 'stop' ||
    message?.refusal ||
    typeof message?.content !== 'string'
  )
    return {};
  let call;
  try {
    ({ call } = JSON.parse(message.content));
  } catch {
    return {};
  }
  if (
    !call ||
    !offered.some((t) => t.function.name === call.name) ||
    !call.arguments ||
    typeof call.arguments !== 'object' ||
    Array.isArray(call.arguments)
  )
    return {};
  return {
    usage: result.usage,
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          tool_calls: [
            {
              id: 'call_' + crypto.randomUUID(),
              type: 'function',
              function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
              },
            },
          ],
        },
      },
    ],
  };
}
