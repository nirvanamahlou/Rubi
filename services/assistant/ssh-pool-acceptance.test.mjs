import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { sshPoolProvider } from '../../scripts/operations/nora-agent/ssh-pool-provider.mjs';
import { ServiceError } from './errors.mjs';

async function peer(t, handle) {
  const pipe =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\nora-test-${randomUUID()}`
      : `/tmp/nora-test-${randomUUID()}.sock`;
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.once('close', () => sockets.delete(socket));
    createInterface({ input: socket }).on('line', (line) =>
      handle(JSON.parse(line), (value) =>
        socket.write(JSON.stringify(value) + '\n'),
      ),
    );
  });
  await new Promise((resolve) => server.listen(pipe, resolve));
  const previous = process.env.NORA_ACCEPTANCE_POOL_PIPE;
  process.env.NORA_ACCEPTANCE_POOL_PIPE = pipe;
  t.after(async () => {
    if (previous === undefined) delete process.env.NORA_ACCEPTANCE_POOL_PIPE;
    else process.env.NORA_ACCEPTANCE_POOL_PIPE = previous;
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  return sshPoolProvider();
}

test('SSH pool retry revalidates local authorization and preserves real attempt charges', async (t) => {
  let request,
    rechecks = 0;
  const provider = await peer(t, (value, send) => {
    if (value.type === 'fetch') {
      request = value;
      send({ type: 'retry', id: value.id });
    } else {
      assert.equal(value.ok, true);
      send({
        type: 'response',
        id: request.id,
        budget: { attempts: 3, retryTokens: 23 },
        status: 200,
        headers: [['content-type', 'application/json']],
        body: JSON.stringify({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                tool_calls: [
                  {
                    id: 'plan1',
                    type: 'function',
                    function: {
                      name: 'set_plan',
                      arguments: '{"steps":["Inspect authorized sources"]}',
                    },
                  },
                ],
              },
            },
          ],
          usage: { total_tokens: 42 },
        }),
      });
    }
  });
  const budget = { attempts: 1, retryTokens: 0 };
  const result = await provider.step([], {
    signal: AbortSignal.timeout(2000),
    allowedTools: ['set_plan'],
    attemptBudget: budget,
    beforeRetry: async () => {
      rechecks++;
    },
  });
  assert.equal(result.name, 'set_plan');
  assert.equal(rechecks, 1);
  assert.deepEqual(budget, { attempts: 3, retryTokens: 23 });
  assert.ok(request.tokenCharge > 0);
  assert.ok(request.remainingTokens > 0);
});

test('SSH pool refuses a revoked retry without releasing another request', async (t) => {
  let grants = 0;
  const provider = await peer(t, (value, send) => {
    if (value.type === 'fetch') send({ type: 'retry', id: value.id });
    else if (value.ok) grants++;
  });
  await assert.rejects(
    provider.step([], {
      signal: AbortSignal.timeout(2000),
      beforeRetry: async () => {
        throw new ServiceError(401, 'UNAUTHENTICATED');
      },
    }),
    /UNAUTHENTICATED/,
  );
  assert.equal(grants, 0);
});

test('SSH pool reports original budget exhaustion instead of a misleading transport outage', async (t) => {
  const provider = await peer(t, (value, send) =>
    send({
      type: 'error',
      id: value.id,
      code: 'AGENT_MODEL_BUDGET_EXCEEDED',
      budget: { attempts: 8, retryTokens: 0 },
    }),
  );
  const budget = { attempts: 7, retryTokens: 0 };
  await assert.rejects(
    provider.step([], {
      signal: AbortSignal.timeout(2000),
      attemptBudget: budget,
    }),
    /AGENT_MODEL_BUDGET_EXCEEDED/,
  );
  assert.equal(budget.attempts, 8);
});

test('a missing IPC peer rejects the call without an unhandled stream error', async (t) => {
  const previous = process.env.NORA_ACCEPTANCE_POOL_PIPE;
  process.env.NORA_ACCEPTANCE_POOL_PIPE =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\nora-missing-${randomUUID()}`
      : `/tmp/nora-missing-${randomUUID()}.sock`;
  t.after(() => {
    if (previous === undefined) delete process.env.NORA_ACCEPTANCE_POOL_PIPE;
    else process.env.NORA_ACCEPTANCE_POOL_PIPE = previous;
  });
  const provider = sshPoolProvider();
  await assert.rejects(
    provider.step([], { signal: AbortSignal.timeout(2000) }),
    /AGENT_PROVIDER_UNAVAILABLE/,
  );
});
