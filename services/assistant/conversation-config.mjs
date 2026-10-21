import { createGroqProvider } from './groq-provider.mjs';

export function conversationConfiguration(env = process.env) {
  if (env.ASSISTANT_CONVERSATION_ENABLED !== 'true') return { enabled: false };
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
