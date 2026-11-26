export const OPENAI_MODEL = 'gpt-6.1-sol';
export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export function openaiChatRequest(body, effort = 'medium') {
  return {
    model: OPENAI_MODEL,
    messages: body.messages,
    max_completion_tokens: body.max_completion_tokens,
    reasoning_effort: effort,
    store: false,
    ...(body.response_format
      ? { response_format: body.response_format }
      : {
          tools: body.tools,
          tool_choice: body.tool_choice,
          parallel_tool_calls: false,
        }),
  };
}
