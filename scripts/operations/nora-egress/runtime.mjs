import { createAssistantServer } from '/nora-source/server.mjs';
import { conversationConfiguration } from '/nora-source/conversation-config.mjs';
import { dataAgentConfiguration } from '/nora-source/agent-config.mjs';
if (
  !['messages-only', 'authorized-erp-results'].includes(
    process.env.ASSISTANT_DATA_POLICY,
  ) ||
  process.env.ASSISTANT_MODEL_PROVIDER !== 'groq' ||
  !process.env.HTTPS_PROXY
) {
  throw new Error('NORA_POLICY_REQUIRED');
}
const service = createAssistantServer({
  conversation: conversationConfiguration(),
  agent: dataAgentConfiguration(),
  identityTimeoutMs: 5000,
  erpBaseUrl: process.env.ERP_API_BASE_URL,
  erpAuthBaseUrl: process.env.ERP_API_BASE_URL,
  erpReportsBaseUrl: process.env.ERP_API_BASE_URL,
});
service.listen(4300, '0.0.0.0');
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => service.close());
}
