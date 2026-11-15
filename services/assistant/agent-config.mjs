import { createAgentProvider } from './agent-provider.mjs';
export function dataAgentConfiguration(env = process.env) {
  if (env.ASSISTANT_AGENT_ENABLED !== 'true') return { enabled: false };
  if (
    env.ASSISTANT_DATA_POLICY !== 'authorized-erp-results' ||
    env.ASSISTANT_MODEL_PROVIDER !== 'groq'
  )
    throw new Error('AGENT_DATA_POLICY_REQUIRED');
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
  return {
    enabled: true,
    provider: createAgentProvider({ apiKey: env.GROQ_API_KEY }),
  };
}
