import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAssistantServer } from './server.mjs';

async function listen(server) {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    if (port > 10080) return `http://127.0.0.1:${port}`;
    await new Promise((resolve) => server.close(resolve));
  }
  throw new Error('TEST_PORT_UNAVAILABLE');
}
async function close(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

test('v3 actual HTTP transport authenticates, executes a model tool and releases cited results', async (t) => {
  const contextId = 'a'.repeat(64);
  const resultId = '12345678-1234-4234-8234-123456789abc';
  let sqlCalls = 0;
  const upstream = createServer(async (request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.headers.cookie !== 'nora_access=synthetic') {
      response.writeHead(401);
      response.end('{}');
      return;
    }
    if (request.url === '/api/v1/iam/auth/access') {
      response.end(
        JSON.stringify({
          userId: 'synthetic',
          branchIds: [],
          permissions: ['sales.contracts.read.all'],
        }),
      );
      return;
    }
    if (request.url === '/api/v1/sales/assistant-agent/catalog') {
      response.end(
        JSON.stringify({
          version: 1,
          contextId,
          rules: [],
          sources: [
            {
              id: 'contracts',
              description: 'Synthetic contracts',
              columns: ['id'],
              grain: 'contract',
            },
          ],
        }),
      );
      return;
    }
    if (
      request.url === '/api/v1/sales/assistant-agent/query' &&
      request.method === 'POST'
    ) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(body.contextId, contextId);
      assert.equal(body.sql, 'SELECT count(*) AS total FROM contracts');
      sqlCalls++;
      response.end(
        JSON.stringify({
          version: 1,
          contextId,
          resultId,
          rows: [{ total: '2' }],
          columns: ['total'],
          sources: ['contracts'],
          observedAt: new Date().toISOString(),
          truncated: false,
          queryHash: 'b'.repeat(64),
          durationMs: 1,
        }),
      );
      return;
    }
    response.writeHead(404);
    response.end('{}');
  });
  const base = await listen(upstream);
  t.after(() => close(upstream));
  const steps = [
    ['set_plan', { steps: ['Count authorized synthetic contracts'] }],
    ['catalog_describe', { source: 'contracts' }],
    ['database_query', { sql: 'SELECT count(*) AS total FROM contracts' }],
    [
      'finish_answer',
      {
        status: 'ANSWER',
        text: 'دو قرارداد نمونه وجود دارد.',
        resultIds: [resultId],
        limitations: [],
      },
    ],
  ];
  let index = 0;
  const server = createAssistantServer({
    erpBaseUrl: base + '/api/v1',
    audit: () => {},
    agent: {
      enabled: true,
      provider: {
        async step() {
          const [name, args] = steps[index];
          return { id: `call_${index++}`, name, args, tokens: 30 };
        },
      },
    },
  });
  const origin = await listen(server);
  t.after(() => close(server));
  const request = (cookie) =>
    fetch(origin + '/v3/assistant/conversation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        version: 1,
        message: 'تعداد قراردادها؟',
        history: [],
      }),
    });
  assert.equal((await request()).status, 401);
  const response = await request(
    'nora_access=synthetic; refresh=NEVER_FORWARD',
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.version, 3);
  assert.equal(result.sources[0].resultId, resultId);
  assert.equal(sqlCalls, 1);
});
