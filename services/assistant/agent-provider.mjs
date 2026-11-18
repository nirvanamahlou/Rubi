import { ServiceError } from './errors.mjs';
import { CALCULATION_POLICY } from './calculation-policy.mjs';
import { compactMessages, usageCounters } from './token-efficiency.mjs';

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
    'contract_count_breakdown',
    'Read all-time contract counts for the current authorized company/scope, excluding hidden records and custom list filters. Disjoint populations: panel_non_cancelled excludes Sales and latest Reservations cancellations; sales_cancelled includes all Sales cancellations; reservation_cancelled_only includes latest Reservations cancellations not already cancelled in Sales. total = panel_non_cancelled + sales_cancelled + reservation_cancelled_only. active_panel = panel_non_cancelled - completed_non_cancelled. Use this evidence and these actual formulas for total/active counts and panel discrepancies; choose prose or table yourself.',
    {},
  ),
  tool(
    'set_plan',
    'First call: state a short operational plan, not private reasoning. Do not claim execution.',
    {
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: { type: 'string', maxLength: 200 },
      },
    },
  ),
  tool(
    'catalog_search',
    'Discover authorized Sales database sources relevant to the question.',
    { query: text },
  ),
  tool(
    'catalog_describe',
    'Read exact columns, grain and meaning of authorized sources. For multi-source questions describe all needed sources together using a source array; a single source string remains supported.',
    {
      source: {
        type: ['string', 'array'],
        items: text,
        minItems: 1,
        maxItems: 5,
      },
    },
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
      calculationExplanation: { type: ['string', 'null'], maxLength: 4000 },
    },
    ['status', 'text', 'resultIds', 'limitations'],
  ),
]);

// A real, advertised final-stage transport tool; never recover rejected generations.
const finalAnswer = AGENT_TOOLS.find(
  (entry) => entry.function.name === 'finish_answer',
);
const finalJsonTool = {
  ...finalAnswer,
  function: { ...finalAnswer.function, name: 'json' },
};

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
    reader.releaseLock();
  }
}

export function createAgentProvider({
  apiKey,
  transport,
  fetcher = fetch,
  now = Date.now,
} = {}) {
  if (transport && typeof transport.fetch !== 'function')
    throw new Error('GROQ_SHARED_POOL_REQUIRED');
  if (
    !transport &&
    (typeof apiKey !== 'string' || !apiKey.trim() || /\s/.test(apiKey))
  )
    throw new Error('AGENT_PROVIDER_KEY_REQUIRED');
  let unavailableUntil = 0;
  return {
    async step(
      messages,
      {
        signal,
        remainingTokens = 40000,
        requireCalculationExplanation = false,
        allowedTools,
        allowFinalResponse = false,
        currentResultIds,
        finalTextChoices,
        beforeRetry,
        attemptBudget,
      },
    ) {
      if (!transport && now() < unavailableUntil) {
        const error = new ServiceError(429, 'AGENT_PROVIDER_RATE_LIMITED');
        error.retryAfterMs = unavailableUntil - now();
        throw error;
      }
      if (
        currentResultIds !== undefined &&
        (!Array.isArray(currentResultIds) ||
          currentResultIds.length > 6 ||
          currentResultIds.some(
            (id) => typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id),
          ))
      )
        throw new ServiceError(502, 'INVALID_AGENT_SOURCE');
      if (
        finalTextChoices !== undefined &&
        (!Array.isArray(finalTextChoices) ||
          !finalTextChoices.length ||
          finalTextChoices.length > 12 ||
          finalTextChoices.some(
            (s) => typeof s !== 'string' || s.length > 300,
          ) ||
          !currentResultIds?.length ||
          !allowFinalResponse ||
          (allowedTools && !allowedTools.includes('finish_answer')))
      )
        throw new ServiceError(502, 'INVALID_AGENT_SOURCE');
      // Short transport references avoid model transcription of opaque UUIDs.
      // Only trusted current evidence supplies the mapping; public IDs stay UUIDs.
      const references = new Map(
        (currentResultIds ?? []).map((id, index) => [id, `ref_${index + 1}`]),
      );
      const originals = new Map([...references].map(([id, ref]) => [ref, id]));
      const decodeFinal = (final) => {
        if (currentResultIds !== undefined && Array.isArray(final?.resultIds))
          return {
            ...final,
            resultIds: final.resultIds.map((ref) => {
              if (originals.has(ref)) return originals.get(ref);
              if (references.has(ref)) return ref;
              throw new ServiceError(502, 'INVALID_AGENT_PLAN');
            }),
          };
        return final;
      };
      const wireMessages = compactMessages(messages).map((message) => {
        if (
          message.role !== 'tool' ||
          typeof message.content !== 'string' ||
          !references.size
        )
          return message;
        let output;
        try {
          output = JSON.parse(message.content);
        } catch {
          return message;
        }
        if (references.has(output?.resultId))
          output = { ...output, resultId: references.get(output.resultId) };
        if (references.has(output?.verifiedSalesReport?.resultId))
          output = {
            ...output,
            verifiedSalesReport: {
              ...output.verifiedSalesReport,
              resultId: references.get(output.verifiedSalesReport.resultId),
            },
          };
        return { ...message, content: JSON.stringify(output) };
      });
      if (references.size)
        wireMessages.push({
          role: 'system',
          content:
            'Transport citation convention: current tool resultId values use short references ' +
            [...originals.keys()].join(', ') +
            '. Copy these exact short references into final resultIds only; do not include internal IDs/references in displayed text. Do not reconstruct UUIDs. Record IDs inside rows are data, never citation IDs.',
        });
      if (requireCalculationExplanation)
        wireMessages.push({
          role: 'system',
          content:
            'Current evidence includes a calculation: final calculationExplanation MUST be a nonempty string, never null, even if the same explanation appears in text. This is a public method summary, not private reasoning.',
        });
      const tools = AGENT_TOOLS.filter(
        (t) =>
          (!allowedTools || allowedTools.includes(t.function.name)) &&
          (!allowFinalResponse || t.function.name !== 'finish_answer'),
      );
      if (
        allowFinalResponse &&
        (!allowedTools || allowedTools.includes('finish_answer'))
      )
        tools.push(
          currentResultIds === undefined
            ? finalJsonTool
            : {
                ...finalJsonTool,
                function: {
                  ...finalJsonTool.function,
                  parameters: {
                    ...finalJsonTool.function.parameters,
                    ...(finalTextChoices || requireCalculationExplanation
                      ? {
                          required: [
                            'status',
                            'text',
                            'resultIds',
                            'limitations',
                            'calculationExplanation',
                          ],
                        }
                      : {}),
                    properties: {
                      ...finalJsonTool.function.parameters.properties,
                      status: {
                        type: 'string',
                        enum: currentResultIds.length
                          ? ['ANSWER', 'CLARIFY', 'REPLY']
                          : ['CLARIFY', 'REPLY'],
                      },
                      resultIds: {
                        type: 'array',
                        maxItems: currentResultIds.length,
                        ...(finalTextChoices ? { minItems: 1 } : {}),
                        items: currentResultIds.length
                          ? { type: 'string', enum: [...originals.keys()] }
                          : { type: 'string' },
                      },
                      ...(requireCalculationExplanation && !finalTextChoices
                        ? {
                            calculationExplanation: {
                              type: 'string',
                              minLength: 1,
                              maxLength: 4000,
                              description:
                                'Required nonempty public calculation summary from the cited evidence, even if also included in text. Never null.',
                            },
                          }
                        : {}),
                      ...(finalTextChoices
                        ? {
                            status: { type: 'string', enum: ['ANSWER'] },
                            text: {
                              type: 'string',
                              enum: [...finalTextChoices],
                            },
                            calculationExplanation: {
                              type: 'string',
                              enum: ['[[sales:method]]'],
                            },
                            limitations: {
                              type: 'array',
                              maxItems: 0,
                              items: { type: 'string' },
                            },
                          }
                        : {}),
                    },
                  },
                },
              },
        );
      const body = JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0,
        reasoning_effort: 'low',
        max_completion_tokens: 2048,
        stream: false,
        messages: [
          ...(!allowFinalResponse &&
          allowedTools?.length === 1 &&
          allowedTools[0] === 'set_plan'
            ? []
            : [{ role: 'system', content: CALCULATION_POLICY }]),
          ...wireMessages,
        ],
        ...(finalTextChoices
          ? {
              // Final facts are already complete. Groq's documented constrained
              // JSON output is separate from tool calling (they cannot be mixed).
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'verified_sales_answer',
                  strict: true,
                  schema: tools.find((t) => t.function.name === 'json').function
                    .parameters,
                },
              },
            }
          : {
              tools,
              tool_choice: allowFinalResponse
                ? 'auto'
                : allowedTools?.length === 1
                  ? { type: 'function', function: { name: allowedTools[0] } }
                  : 'required',
              parallel_tool_calls: false,
            }),
      });
      const wireBody = body;
      if (Buffer.byteLength(wireBody) > 256 * 1024)
        throw new ServiceError(503, 'AGENT_CONTEXT_BUDGET_EXCEEDED');
      // UTF-8 bytes plus reserved completion/protocol allowance is a conservative
      // upper bound; do not start a provider call that can exhaust the run budget.
      if (Buffer.byteLength(body) + 3072 > remainingTokens)
        throw new ServiceError(429, 'AGENT_TOKEN_BUDGET_EXCEEDED');
      try {
        const response = await (transport?.fetch ?? fetcher)(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              ...(!transport ? { authorization: `Bearer ${apiKey}` } : {}),
              'content-type': 'application/json',
            },
            body: wireBody,
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
          },
          {
            beforeRetry,
            attemptBudget,
            remainingTokens,
            tokenCharge: Buffer.byteLength(body) + 3072,
          },
        );
        if (!response.ok) {
          const status = response.status;
          if (
            status === 400 &&
            response.headers.get('content-type')?.includes('application/json')
          ) {
            const rejected = await boundedAgentJson(response, 65536);
            if (
              ['tool_use_failed', 'output_parse_failed'].includes(
                rejected?.error?.code,
              )
            ) {
              const error = new ServiceError(
                503,
                'AGENT_PROVIDER_TOOL_REJECTED',
              );
              // Charge a conservative upper bound even if rejected completion
              // usage is unavailable. Never inspect/execute failed_generation.
              error.tokenCharge = Buffer.byteLength(body) + 3072;
              throw error;
            }
          }
          if (status === 429) {
            const header = response.headers.get('retry-after');
            const seconds =
              header && /^\d+(?:\.\d+)?$/.test(header)
                ? Number(header)
                : header
                  ? (Date.parse(header) - now()) / 1000
                  : NaN;
            const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : 60;
            unavailableUntil = now() + Math.min(wait, 86400) * 1000;
          }
          await response.body?.cancel();
          const error = new ServiceError(
            status === 429 ? 429 : 503,
            status === 429
              ? 'AGENT_PROVIDER_RATE_LIMITED'
              : status === 401 || status === 403
                ? 'AGENT_PROVIDER_ACCESS_DENIED'
                : status === 400
                  ? 'AGENT_PROVIDER_REQUEST_REJECTED'
                  : 'AGENT_PROVIDER_UNAVAILABLE',
          );
          if (status === 429) error.retryAfterMs = unavailableUntil - now();
          throw error;
        }
        const result = await boundedAgentJson(response, 65536);
        const choice = result.choices?.[0];
        const calls = choice?.message?.tool_calls;
        if (result.choices?.length !== 1)
          throw new ServiceError(502, 'INVALID_AGENT_PLAN');
        if (
          choice?.finish_reason === 'stop' &&
          typeof choice.message?.content === 'string'
        ) {
          if (!allowFinalResponse || calls?.length)
            throw new ServiceError(502, 'INVALID_AGENT_PLAN');
          const final = JSON.parse(choice.message.content);
          if (
            !final ||
            ![
              'limitations,resultIds,status,text',
              'calculationExplanation,limitations,resultIds,status,text',
            ].includes(Object.keys(final).sort().join(',')) ||
            !['ANSWER', 'CLARIFY', 'REPLY'].includes(final.status)
          )
            throw new ServiceError(502, 'INVALID_AGENT_PLAN');
          const tokens = result.usage?.total_tokens;
          if (!Number.isSafeInteger(tokens) || tokens < 0)
            throw new ServiceError(502, 'INVALID_AGENT_USAGE');
          return {
            id: 'final_' + crypto.randomUUID(),
            name: 'finish_answer',
            args: decodeFinal(final),
            tokens,
            usage: usageCounters(result.usage),
          };
        }
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
          !tools.some((entry) => entry.function.name === call.function?.name) ||
          typeof call.function.arguments !== 'string' ||
          Buffer.byteLength(call.function.arguments) > 16000
        )
          throw new ServiceError(502, 'INVALID_AGENT_PLAN');
        const tokens = result.usage?.total_tokens;
        if (!Number.isSafeInteger(tokens) || tokens < 0)
          throw new ServiceError(502, 'INVALID_AGENT_USAGE');
        return {
          id: call.id,
          name:
            call.function.name === 'json'
              ? 'finish_answer'
              : call.function.name,
          args:
            call.function.name === 'json'
              ? decodeFinal(JSON.parse(call.function.arguments))
              : JSON.parse(call.function.arguments),
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
