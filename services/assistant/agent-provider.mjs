import { ServiceError } from './errors.mjs';

const tool = (
  name,
  description,
  properties,
  required = Object.keys(properties),
) => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    },
  },
});
const text = { type: 'string' };
const strings = { type: 'array', items: text };
export const AGENT_TOOLS = Object.freeze([
  tool(
    'set_plan',
    'First call: state a short operational plan, not private reasoning. Do not claim execution.',
    { steps: strings },
  ),
  tool(
    'catalog_search',
    'Discover authorized Sales database sources relevant to the question.',
    { query: text },
  ),
  tool(
    'catalog_describe',
    'Read exact columns, grain and meaning of one authorized source.',
    { source: text },
  ),
  tool(
    'database_query',
    'Run one read-only PostgreSQL SELECT against discovered nora_agent views. Keep currencies separate. Maximum 200 output rows; aggregate in SQL.',
    { sql: text },
  ),
  tool(
    'finish_answer',
    "Deliver final response using this turn's evidence. Clarify ambiguity or explain unsupported scope. Never invent facts.",
    {
      status: { type: 'string', enum: ['ANSWER', 'CLARIFY', 'REPLY'] },
      text,
      resultIds: strings,
      limitations: strings,
    },
  ),
]);

export async function boundedAgentJson(response, limit = 256 * 1024) {
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new ServiceError(502, 'INVALID_AGENT_RESPONSE');
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError(502, 'INVALID_AGENT_RESPONSE');
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new ServiceError(502, 'AGENT_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export function createAgentProvider({ apiKey, fetcher = fetch } = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey))
    throw new Error('AGENT_PROVIDER_KEY_REQUIRED');
  return {
    async step(messages, { signal, remainingTokens = 40000 }) {
      const body = JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0,
        reasoning_effort: 'low',
        max_completion_tokens: 2048,
        stream: false,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: 'required',
        parallel_tool_calls: false,
      });
      if (Buffer.byteLength(body) > 256 * 1024)
        throw new ServiceError(503, 'AGENT_CONTEXT_BUDGET_EXCEEDED');
      // UTF-8 bytes plus reserved completion/protocol allowance is a conservative
      // upper bound; do not start a provider call that can exhaust the run budget.
      if (Buffer.byteLength(body) + 3072 > remainingTokens)
        throw new ServiceError(429, 'AGENT_TOKEN_BUDGET_EXCEEDED');
      try {
        const response = await fetcher(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
            body,
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw new ServiceError(
            response.status === 429 ? 429 : 503,
            'AGENT_PROVIDER_UNAVAILABLE',
          );
        }
        const result = await boundedAgentJson(response, 65536);
        const choice = result.choices?.[0];
        const calls = choice?.message?.tool_calls;
        if (
          result.choices?.length !== 1 ||
          choice.finish_reason !== 'tool_calls' ||
          !Array.isArray(calls) ||
          calls.length !== 1
        )
          throw new ServiceError(502, 'INVALID_AGENT_PLAN');
        const call = calls[0];
        if (
          call.type !== 'function' ||
          typeof call.id !== 'string' ||
          !/^[a-zA-Z0-9_-]{1,128}$/.test(call.id) ||
          !AGENT_TOOLS.some(
            (entry) => entry.function.name === call.function?.name,
          ) ||
          typeof call.function.arguments !== 'string' ||
          Buffer.byteLength(call.function.arguments) > 16000
        )
          throw new ServiceError(502, 'INVALID_AGENT_PLAN');
        const tokens = result.usage?.total_tokens;
        if (!Number.isSafeInteger(tokens) || tokens < 0)
          throw new ServiceError(502, 'INVALID_AGENT_USAGE');
        return {
          id: call.id,
          name: call.function.name,
          args: JSON.parse(call.function.arguments),
          tokens,
        };
      } catch (error) {
        if (error instanceof ServiceError) throw error;
        throw new ServiceError(
          503,
          signal.aborted ? 'AGENT_TIMEOUT' : 'AGENT_PROVIDER_UNAVAILABLE',
        );
      }
    },
  };
}
