import { createGroqProvider } from './groq-provider.mjs';

export function conversationConfiguration(env = process.env) {
  if (env.ASSISTANT_CONVERSATION_ENABLED !== 'true') return { enabled: false };
  // v3 has its own explicit policy and provider. Keep v2 off rather than
  // accidentally applying its obsolete messages-only contract to ERP results.
  if (
    env.ASSISTANT_AGENT_ENABLED === 'true' &&
    env.ASSISTANT_DATA_POLICY === 'authorized-erp-results'
  )
    return { enabled: false };
  if (
    env.ASSISTANT_DATA_POLICY !== 'messages-only' ||
    env.ASSISTANT_MODEL_PROVIDER !== 'groq'
  )
    throw new Error('CONVERSATION_POLICY_CONFIGURATION_REQUIRED');
  return {
    enabled: true,
    timeoutMs: 6000,
    provider: createGroqProvider({ apiKey: env.GROQ_API_KEY, timeoutMs: 6000 }),
  };
}
