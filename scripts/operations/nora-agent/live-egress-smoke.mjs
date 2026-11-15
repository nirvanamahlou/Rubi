// Synthetic only. Invoke with proxy environment set before Node starts.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { dataAgentConfiguration } from '../../../services/assistant/agent-config.mjs';

const path = process.env.NORA_ACCEPTANCE_PRIVATE_ENV_FILE;
if (!path) throw new Error('PRIVATE_ENV_FILE_REQUIRED');
const privateEnv = parseEnv(readFileSync(path, 'utf8'));
const { provider } = dataAgentConfiguration({
  ...process.env,
  GROQ_API_KEY: privateEnv.GROQ_API_KEY,
});
if (!provider) throw new Error('AGENT_DISABLED');
try {
  const result = await provider.step(
    [
      {
        role: 'system',
        content:
          'Synthetic transport test only. Call set_plan with one step: Synthetic check. Do not access business data.',
      },
      { role: 'user', content: 'Run the synthetic check.' },
    ],
    { signal: AbortSignal.timeout(20000) },
  );
  if (result.name !== 'set_plan') throw new Error('EXPECTED_NATIVE_TOOL_CALL');
  console.log(
    JSON.stringify({ success: true, tool: result.name, tokens: result.tokens }),
  );
} catch (error) {
  console.log(
    JSON.stringify({ success: false, code: error.code ?? 'SMOKE_FAILED' }),
  );
  process.exitCode = 1;
}
