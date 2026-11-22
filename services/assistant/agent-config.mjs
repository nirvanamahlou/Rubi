import { createAgentProvider } from './agent-provider.mjs';
import { quotaFailover } from './provider-failover.mjs';
export function dataAgentConfiguration(
  env = process.env,
  { transport, openaiTransport } = {},
) {
  if (
    env.GROQ_KEY_POOL_FILE &&
    !transport &&
    env.ASSISTANT_AGENT_ENABLED === 'true'
  )
    throw new Error('GROQ_SHARED_POOL_REQUIRED');
  if (env.ASSISTANT_AGENT_ENABLED !== 'true') return { enabled: false };
  if (
    env.ASSISTANT_DATA_POLICY !== 'authorized-erp-results' ||
    !['groq', 'hybrid'].includes(env.ASSISTANT_MODEL_PROVIDER)
  )
    throw new Error('AGENT_DATA_POLICY_REQUIRED');
  requireGermanyProxy(env);
  const provider = createAgentProvider({ apiKey: env.GROQ_API_KEY, transport });
  if (env.ASSISTANT_MODEL_PROVIDER === 'groq')
    return { enabled: true, provider };
  if (!openaiTransport) throw new Error('OPENAI_SHARED_POOL_REQUIRED');
  const openai = createAgentProvider({
    provider: 'openai',
    transport: openaiTransport,
  });
  return {
    enabled: true,
    provider,
    selectProvider: (request, { consumptionExempt = false } = {}) => {
      const simple = isSimpleAgentRequest(request);
      const preferred = simple ? provider : openai;
      return consumptionExempt
        ? quotaFailover(preferred, simple ? openai : provider)
        : preferred;
    },
  };
}

// Route once per request. Short questions can still ask for complex calculations.
export function isSimpleAgentRequest({ message, history, context }) {
  if (history.length || context || message.length > 120) return false;
  const normalized = message
    .normalize('NFKC')
    .trim()
    .replace(/[؟?!]+$/, '')
    .trim();
  return /^(?:سلام|درود|سلام نورا|ممنون|متشکرم|تعداد (?:کل |همه )?قراردادهای قابل مشاهده چقدر است|تعداد قراردادهای خودم چقدر است)$/u.test(
    normalized,
  );
}
export function requireGermanyProxy(env) {
  let proxy;
  try {
    proxy = new URL(env.HTTPS_PROXY);
  } catch {
    throw new Error('AGENT_GERMANY_PROXY_REQUIRED');
  }
  const bypassesGroq = (env.NO_PROXY ?? env.no_proxy ?? '')
    .split(',')
    .some((entry) => {
      const host = entry.trim().toLowerCase().replace(/:\d+$/, '');
      return (
        host === '*' ||
        host === 'api.groq.com' ||
        host === 'groq.com' ||
        host === '.groq.com' ||
        host === '*.groq.com'
      );
    });
  if (
    env.ASSISTANT_GROQ_EGRESS !== 'germany-proxy' ||
    env.NODE_USE_ENV_PROXY !== '1' ||
    proxy.protocol !== 'http:' ||
    proxy.username ||
    proxy.password ||
    proxy.search ||
    proxy.hash ||
    proxy.pathname !== '/' ||
    !['127.0.0.1', 'localhost', '172.18.0.1'].includes(proxy.hostname) ||
    proxy.port !== '4310' ||
    bypassesGroq ||
    (env.https_proxy && env.https_proxy !== env.HTTPS_PROXY) ||
    (env.no_proxy && env.NO_PROXY && env.no_proxy !== env.NO_PROXY)
  )
    throw new Error('AGENT_GERMANY_PROXY_REQUIRED');
}
