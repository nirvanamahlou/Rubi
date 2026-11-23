import {
  OPENAI_ENDPOINT,
  responsesRequest,
  responsesResult,
} from './openai-responses.mjs';
import catalog from './workbench-guides.json' with { type: 'json' };
import callCenter from './call-center-guides.json' with { type: 'json' };
import { ServiceError } from './errors.mjs';
import { boundedAgentJson } from './agent-provider.mjs';
import { dataAgentConfiguration } from './agent-config.mjs';

export function validateWorkbenchGuide(value) {
  if (
    !value ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).some(
      (k) => !['version', 'topicId', 'goal'].includes(k),
    ) ||
    value.version !== 1 ||
    ![...catalog.topics, ...callCenter.topics].some(
      (t) => t.id === value.topicId,
    ) ||
    !['steps', 'troubleshoot', 'follow-up'].includes(value.goal)
  )
    throw new ServiceError(400, 'INVALID_GUIDE_INPUT');
  return { version: 1, topicId: value.topicId, goal: value.goal };
}

export function createWorkbenchGuideSelector({
  apiKey,
  transport,
  openaiTransport,
  fetcher = fetch,
  now = Date.now,
} = {}) {
  let unavailableUntil = 0;
  return async (
    input,
    signal,
    { beforeRetry, consumptionExempt = false } = {},
  ) => {
    const safe = validateWorkbenchGuide(input);
    const fallback = () => ({ ...safe, selection: 'internal' });
    if ((!apiKey && !transport) || (!transport && now() < unavailableUntil))
      return fallback();
    try {
      const attemptBudget = {
        attempts: 0,
        retryTokens: 0,
        ...(consumptionExempt ? { maxAttempts: Number.MAX_SAFE_INTEGER } : {}),
      };
      let usedOpenAI = false;
      const fetchWithFailover = async (url, init, options) => {
        const response = await (transport?.fetch ?? fetcher)(
          url,
          init,
          options,
        );
        if (response.status !== 429 || !consumptionExempt || !openaiTransport)
          return response;
        await response.body?.cancel();
        if (beforeRetry) await beforeRetry();
        if (signal.aborted) throw new ServiceError(503, 'AGENT_TIMEOUT');
        usedOpenAI = true;
        const body = responsesRequest(
          { ...JSON.parse(init.body), max_completion_tokens: 1024 },
          'low',
        );
        return openaiTransport.fetch(
          OPENAI_ENDPOINT,
          { ...init, body: JSON.stringify(body) },
          options,
        );
      };
      const response = await fetchWithFailover(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
          headers: {
            ...(!transport ? { authorization: `Bearer ${apiKey}` } : {}),
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            temperature: 0,
            reasoning_effort: 'low',
            max_completion_tokens: 256,
            parallel_tool_calls: false,
            messages: [
              {
                role: 'system',
                content:
                  'Select the Workbench procedural guide tool. Only use the supplied catalog topic and goal. Do not read records, execute SQL, or write instructions.',
              },
              { role: 'user', content: JSON.stringify(safe) },
            ],
            tool_choice: 'auto',
            tools: [
              {
                type: 'function',
                function: {
                  name: 'workbench_guide',
                  description:
                    'Read a vetted procedural guide; no employee records or writes.',
                  parameters: {
                    type: 'object',
                    properties: {
                      topicId: { type: 'string', enum: [safe.topicId] },
                      goal: { type: 'string', enum: [safe.goal] },
                    },
                    required: ['topicId', 'goal'],
                    additionalProperties: false,
                  },
                },
              },
            ],
          }),
        },
        { beforeRetry, attemptBudget },
      );
      if (!response.ok) {
        if (response.status === 429) {
          const seconds = Number(response.headers.get('retry-after'));
          unavailableUntil =
            now() +
            Math.min(
              86400000,
              Math.max(
                60000,
                Number.isFinite(seconds) ? seconds * 1000 : 60000,
              ),
            );
        }
        await response.body?.cancel();
        return fallback();
      }
      const payload = await boundedAgentJson(response, 16384);
      const body = usedOpenAI ? responsesResult(payload) : payload;
      const calls = body.choices?.[0]?.message?.tool_calls;
      if (
        !Array.isArray(calls) ||
        calls.length !== 1 ||
        calls[0].function?.name !== 'workbench_guide'
      )
        return fallback();
      const args = JSON.parse(calls[0].function.arguments);
      if (
        Object.keys(args).length !== 2 ||
        args.topicId !== safe.topicId ||
        args.goal !== safe.goal
      )
        return fallback();
      return { ...safe, selection: 'model' };
    } catch (error) {
      if (signal.aborted) throw error;
      return fallback();
    }
  };
}

export function workbenchGuideConfiguration(
  env = process.env,
  { transport, openaiTransport } = {},
) {
  // Reuse the existing Germany-only startup admission; never add a direct fallback.
  if (env.ASSISTANT_AGENT_ENABLED !== 'true') return {};
  dataAgentConfiguration(env, { transport, openaiTransport });
  return transport
    ? { transport, openaiTransport }
    : { apiKey: env.GROQ_API_KEY };
}
