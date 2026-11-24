import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createConnection, createServer } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { createAgentProvider } from '../../../services/assistant/agent-provider.mjs';
import { ServiceError } from '../../../services/assistant/errors.mjs';

// Synthetic acceptance only. Credentials remain in the remote container. The
// interactive retry handshake keeps authorization checks on the local Agent.
const remote = `
import {createInterface} from 'node:readline';
const {createGroqKeyPool}=await import('data:text/javascript;base64,'+poolModule);
import {readGroqCredentials} from 'file:///nora-source/groq-credentials.mjs';
import {requireGermanyProxy} from 'file:///nora-source/agent-config.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
requireGermanyProxy(process.env);
for(const [name,hash] of Object.entries(expected)){
 if(createHash('sha256').update(readFileSync('/nora-source/'+name,'utf8').replaceAll('\\r\\n','\\n')).digest('hex')!==hash)throw Error('ACCEPTANCE_REMOTE_SOURCE_MISMATCH');
}
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
const pool=createGroqKeyPool({entries:readGroqCredentials(),audit:value=>send({type:'audit',value})});
let pending;
const input=createInterface({input:process.stdin});
input.on('line',async line=>{
 const x=JSON.parse(line);
 if(x.type==='retry-result'){const p=pending;pending=null;x.ok?p?.resolve():p?.reject(Error('AUTHORIZATION_RECHECK_FAILED'));return;}
 if(x.type!=='fetch')return;
 const budget=x.budget;
 try{
  const response=await pool.fetch('https://api.groq.com/openai/v1/chat/completions',{
   method:'POST',body:x.body,headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(14000)
  },{attemptBudget:budget,remainingTokens:x.remainingTokens,tokenCharge:x.tokenCharge,beforeRetry:()=>new Promise((resolve,reject)=>{pending={resolve,reject};send({type:'retry',id:x.id});})});
  send({type:'response',id:x.id,budget,status:response.status,headers:[...response.headers],body:await response.text()});
 }catch(error){send({type:'error',id:x.id,budget,code:['AGENT_MODEL_BUDGET_EXCEEDED','AGENT_TOKEN_BUDGET_EXCEEDED','GROQ_TRANSPORT_UNAVAILABLE','INVALID_AGENT_USAGE'].includes(error.message)?error.message:'ACCEPTANCE_TRANSPORT_FAILED'});}
});
`;

function remoteProcess() {
  const expected = Object.fromEntries(
    [
      'groq-credentials.mjs',
      'agent-config.mjs',
      'errors.mjs',
      'openai-responses.mjs',
    ].map((name) => [
      name,
      createHash('sha256')
        .update(
          readFileSync(
            new URL('../../../services/assistant/' + name, import.meta.url),
            'utf8',
          ).replaceAll('\r\n', '\n'),
        )
        .digest('hex'),
    ]),
  );
  const poolModule = Buffer.from(
    readFileSync(
      new URL('../../../services/assistant/groq-key-pool.mjs', import.meta.url),
      'utf8',
    )
      .replaceAll("'./errors.mjs'", "'file:///nora-source/errors.mjs'")
      .replaceAll(
        "'./openai-responses.mjs'",
        "'file:///nora-source/openai-responses.mjs'",
      )
      .replaceAll(
        "'./groq-credentials.mjs'",
        "'file:///nora-source/groq-credentials.mjs'",
      ),
  ).toString('base64');
  const encoded = Buffer.from(
    'const expected=' +
      JSON.stringify(expected) +
      ';const poolModule=' +
      JSON.stringify(poolModule) +
      ';\n' +
      remote,
  ).toString('base64');
  const child = spawn(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      '-o',
      'StrictHostKeyChecking=yes',
      '-o',
      'ServerAliveInterval=15',
      '-o',
      'ServerAliveCountMax=3',
      process.env.NORA_ACCEPTANCE_SSH_HOST ?? 'erp-server',
      `sudo -n docker exec -i rubi-nora-assistant node --use-env-proxy --input-type=module -e "import('data:text/javascript;base64,${encoded}')"`,
    ],
    { windowsHide: true },
  );
  return child;
}

/** One process-local pool for the entire serial matrix, as in production. */
export async function startSshPoolBroker() {
  const pipe =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\nora-acceptance-${randomUUID()}`
      : `/tmp/nora-acceptance-${randomUUID()}.sock`;
  const remote = remoteProcess();
  remote.stderr.on('data', (data) => {
    if (process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR)
      appendFileSync(
        resolve(
          process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR,
          'broker-stderr.log',
        ),
        data,
      );
  });
  let closed = false;
  let active;
  const server = createServer((socket) => {
    if (active) {
      socket.destroy();
      return;
    }
    active = socket;
    socket.pipe(remote.stdin, { end: false });
    const output = (data) => socket.write(data);
    remote.stdout.on('data', output);
    socket.on('error', () => {});
    socket.once('close', () => {
      remote.stdout.off('data', output);
      active = undefined;
    });
  });
  remote.on('error', () => active?.destroy());
  remote.on('close', () => {
    closed = true;
    active?.destroy();
    server.close();
  });
  remote.stdin.on('error', () => active?.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(pipe, resolve);
  });
  return {
    pipe,
    assertHealthy() {
      if (closed) throw Error('ACCEPTANCE_POOL_EXITED_REVIEW_REQUIRED');
    },
    close() {
      active?.destroy();
      server.close();
      remote.stdin.end();
      remote.kill();
    },
  };
}

export function sshPoolProvider() {
  const socket = process.env.NORA_ACCEPTANCE_POOL_PIPE
    ? createConnection(process.env.NORA_ACCEPTANCE_POOL_PIPE)
    : null;
  const child = socket
    ? Object.assign(socket, {
        stdin: socket,
        stdout: socket,
        stderr: null,
        kill: () => socket.destroy(),
      })
    : remoteProcess();
  // The helper owns no server state and exits on EOF. Never keep a test worker
  // alive merely because its private SSH pipe is still open.
  child.unref();
  child.stdin.unref();
  child.stdout.unref();
  child.stderr?.on('data', (data) => {
    if (process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR)
      appendFileSync(
        resolve(
          process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR,
          'ssh-helper.log',
        ),
        data,
      );
  });
  child.stderr?.unref();
  const requests = new Map();
  let sequence = 0;
  const send = (value) => child.stdin.write(JSON.stringify(value) + '\n');
  const fail = () => {
    for (const request of requests.values())
      request.reject(Error('ACCEPTANCE_TRANSPORT_FAILED'));
    requests.clear();
  };
  child.on('error', fail);
  child.on('close', fail);
  child.stdin.on('error', fail);
  createInterface({ input: child.stdout })
    .on('error', fail)
    .on('line', async (line) => {
      let value;
      try {
        value = JSON.parse(line);
      } catch {
        fail();
        return;
      }
      if (value.type === 'audit') {
        if (process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR)
          appendFileSync(
            resolve(
              process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR,
              'pool-audit.jsonl',
            ),
            JSON.stringify(value.value) + '\n',
          );
        return;
      }
      const request = requests.get(value.id);
      if (!request) return;
      if (value.type === 'retry') {
        try {
          await request.beforeRetry?.();
          request.signal.throwIfAborted();
          send({ type: 'retry-result', ok: true });
        } catch (error) {
          send({ type: 'retry-result', ok: false });
          request.reject(error);
        }
        return;
      }
      requests.delete(value.id);
      request.cleanup();
      if (
        value.type === 'response' &&
        process.env.NORA_ACCEPTANCE_SYNTHETIC_DIAGNOSTICS === 'true' &&
        process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR
      )
        appendFileSync(
          resolve(
            process.env.NORA_AGENT_ACCEPTANCE_RECEIPT_DIR,
            'provider-responses.jsonl',
          ),
          JSON.stringify({ status: value.status, body: value.body }) + '\n',
        );
      if (value.budget && request.budget)
        Object.assign(request.budget, value.budget);
      if (value.type === 'response')
        request.resolve(
          new Response(value.body, {
            status: value.status,
            headers: value.headers,
          }),
        );
      else
        request.reject(
          new ServiceError(
            503,
            [
              'AGENT_MODEL_BUDGET_EXCEEDED',
              'AGENT_TOKEN_BUDGET_EXCEEDED',
              'GROQ_TRANSPORT_UNAVAILABLE',
              'INVALID_AGENT_USAGE',
            ].includes(value.code)
              ? value.code
              : 'ACCEPTANCE_TRANSPORT_FAILED',
          ),
        );
    });
  process.once('exit', () => {
    child.stdin.end();
    child.kill();
  });
  return createAgentProvider({
    transport: {
      fetch(_url, init, options) {
        return new Promise((resolve, reject) => {
          const id = ++sequence;
          const aborted = () => {
            requests.delete(id);
            reject(Error('ACCEPTANCE_TRANSPORT_ABORTED'));
            child.kill();
          };
          init.signal.throwIfAborted();
          init.signal.addEventListener('abort', aborted, { once: true });
          requests.set(id, {
            resolve,
            reject,
            beforeRetry: options.beforeRetry,
            signal: init.signal,
            budget: options.attemptBudget,
            cleanup: () => init.signal.removeEventListener('abort', aborted),
          });
          send({
            type: 'fetch',
            id,
            body: init.body,
            budget: options.attemptBudget,
            remainingTokens: options.remainingTokens,
            tokenCharge: options.tokenCharge,
          });
        });
      },
    },
  });
}
