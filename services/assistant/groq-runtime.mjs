import { readGroqCredentials } from './groq-credentials.mjs';
import { createGroqKeyPool } from './groq-key-pool.mjs';
import {
  dataAgentConfiguration,
  requireGermanyProxy,
} from './agent-config.mjs';
import { conversationConfiguration } from './conversation-config.mjs';
import { workbenchGuideConfiguration } from './workbench-guide.mjs';

/** Call once per service process, including custom deployment entry points. */
export function groqConfigurations(
  env = process.env,
  { fetcher, now, audit } = {},
) {
  const active =
    env.ASSISTANT_AGENT_ENABLED === 'true' ||
    env.ASSISTANT_CONVERSATION_ENABLED === 'true';
  if (!active)
    return {
      agent: { enabled: false },
      conversation: { enabled: false },
      workbenchGuide: {},
    };
  requireGermanyProxy(env);
  const transport = createGroqKeyPool({
    entries: readGroqCredentials(env),
    fetcher,
    now,
    audit,
  });
  const openaiTransport =
    env.ASSISTANT_AGENT_ENABLED === 'true' &&
    env.ASSISTANT_MODEL_PROVIDER === 'hybrid'
      ? createGroqKeyPool({
          provider: 'openai',
          entries: readGroqCredentials({
            GROQ_KEY_POOL_FILE: env.OPENAI_KEY_POOL_FILE || undefined,
            GROQ_API_KEY: env.OPENAI_API_KEY,
          }),
          fetcher,
          now,
          audit,
        })
      : undefined;
  return {
    agent: dataAgentConfiguration(env, { transport, openaiTransport }),
    conversation: conversationConfiguration(env, { transport }),
    workbenchGuide: workbenchGuideConfiguration(env, {
      transport,
      openaiTransport,
    }),
  };
}
