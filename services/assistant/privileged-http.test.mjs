import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createAssistantServer } from './server.mjs';
const privileged = '11111111-1111-4111-8111-111111111111';
const ordinary = '22222222-2222-4222-8222-222222222222';
async function listen(server, t) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return `http://127.0.0.1:${server.address().port}`;
}
test('HTTP trusts only native identity for model quota policy; forged body/headers cannot grant it', async (t) => {
  const optionsSeen = [];
  const upstream = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url.endsWith('/iam/auth/access')) {
      response.end(
        JSON.stringify({
          userId:
            request.headers.cookie === 'nora_access=privileged'
              ? privileged
              : ordinary,
          branchIds: [],
          permissions: ['sales.contracts.read.all'],
        }),
      );
    } else
      response.end(
        JSON.stringify({
          version: 1,
          contextId: 'a'.repeat(64),
          sources: [],
          rules: [],
        }),
      );
  });
  const erp = await listen(upstream, t);
  const server = createAssistantServer({
    erpBaseUrl: erp + '/api/v1',
    rateLimitExemptUserIds: [privileged],
    audit: () => {},
    agent: {
      enabled: true,
      selectProvider: (_request, options) => {
        optionsSeen.push(options.consumptionExempt);
        let step = 0;
        return {
          step: async (_messages, parameters) => {
            assert.equal(
              parameters.remainingTokens,
              options.consumptionExempt
                ? Number.MAX_SAFE_INTEGER - (step ? 50001 : 0)
                : 40000,
            );
            return ++step === 1
              ? {
                  id: 'plan',
                  name: 'set_plan',
                  args: { steps: ['بررسی درخواست'] },
                  tokens: 50001,
                }
              : {
                  id: 'final',
                  name: 'finish_answer',
                  args: {
                    status: 'REPLY',
                    text: 'سلام.',
                    resultIds: [],
                    limitations: [],
                  },
                  tokens: 5,
                };
          },
        };
      },
    },
  });
  const base = await listen(server, t);
  const send = (cookie, extra = {}, headers = {}) =>
    fetch(base + '/v3/assistant/conversation', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, ...headers },
      body: JSON.stringify({
        version: 1,
        message: 'سلام',
        history: [],
        ...extra,
      }),
    });
  assert.equal((await send('nora_access=privileged')).status, 200);
  const normal = await send(
    'nora_access=ordinary',
    {},
    { 'x-user-id': privileged, 'x-username': 'demo' },
  );
  assert.equal(normal.status, 429);
  assert.equal((await normal.json()).error.code, 'AGENT_TOKEN_BUDGET_EXCEEDED');
  assert.equal(
    (await send('nora_access=ordinary', { consumptionExempt: true })).status,
    400,
  );
  assert.deepEqual(optionsSeen, [true, false]);
});
