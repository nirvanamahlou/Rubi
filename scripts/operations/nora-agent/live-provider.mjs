import { appendFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createAgentProvider } from '../../../services/assistant/agent-provider.mjs';

// Synthetic acceptance payloads only; no files or environment changes on ERP.
export function liveProvider() {
  const diagnosticDirectory =
    process.env.NORA_ACCEPTANCE_SYNTHETIC_DIAGNOSTICS === 'true'
      ? process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR
      : undefined;
  return createAgentProvider({
    apiKey: 'synthetic-local-placeholder',
    fetcher: async (_url, options) => {
      const code = `(async()=>{const chunks=[];for await(const c of process.stdin)chunks.push(c);const b=Buffer.concat(chunks).toString();if(process.env.NODE_USE_ENV_PROXY!=='1'||process.env.HTTPS_PROXY!=='http://172.18.0.1:4310')throw Error('PROXY_REQUIRED');const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer '+process.env.GROQ_API_KEY,'content-type':'application/json'},body:b,redirect:'error',signal:AbortSignal.timeout(15000)});const body=await r.json();console.log(JSON.stringify({status:r.status,body,retryAfter:r.headers.get('retry-after'),rateUnit:['TPM','TPD','RPM','RPD'].filter(v=>body.error?.message?.includes(v))}));})().catch(()=>{process.exitCode=1});`;
      const encoded = Buffer.from(code).toString('base64');
      const output = await new Promise((resolve, reject) => {
        const child = spawn(
          'ssh',
          [
            '-o',
            'BatchMode=yes',
            '-o',
            'StrictHostKeyChecking=yes',
            'erp-server',
            `sudo -n docker exec -i rubi-nora-assistant node --input-type=module -e "eval(Buffer.from('${encoded}','base64').toString())"`,
          ],
          { windowsHide: true, signal: options.signal },
        );
        let data = '';
        child.stdout.on('data', (chunk) => {
          data += chunk;
          if (data.length > 100000) child.kill();
        });
        child.stderr.resume();
        child.on('error', reject);
        child.on('close', (code) =>
          code === 0
            ? resolve(data)
            : reject(new Error('ACCEPTANCE_TRANSPORT_FAILED')),
        );
        child.stdin.end(options.body);
      });
      const result = JSON.parse(output);
      if (diagnosticDirectory)
        appendFileSync(
          resolve(diagnosticDirectory, 'nora-groq-shapes.jsonl'),
          JSON.stringify({
            status: result.status,
            finish: result.body.choices?.[0]?.finish_reason,
            content: result.body.choices?.[0]?.message?.content,
            calls: result.body.choices?.[0]?.message?.tool_calls?.map((c) => ({
              id: c.id,
              name: c.function?.name,
              args: c.function?.arguments,
            })),
          }) + '\n',
        );
      if (diagnosticDirectory && result.status !== 200)
        appendFileSync(
          resolve(diagnosticDirectory, 'nora-groq-errors.jsonl'),
          JSON.stringify({
            status: result.status,
            code: result.body?.error?.code ?? 'unknown',
            retryAfter: result.retryAfter,
            rateUnit: result.rateUnit,
            generation: result.body?.error?.failed_generation,
          }) + '\n',
        );
      return Response.json(result.body, {
        status: result.status,
        headers: result.retryAfter ? { 'retry-after': result.retryAfter } : {},
      });
    },
  });
}
