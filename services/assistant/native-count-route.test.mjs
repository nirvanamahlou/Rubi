import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeCountRoute } from './native-count-route.mjs';
import { createDataAgent } from './data-agent.mjs';

const contextId = 'a'.repeat(64);
const resultId = '11111111-1111-1111-1111-111111111111';
const row = {
  panel_non_cancelled: 7,
  sales_cancelled: 2,
  reservation_cancelled_only: 3,
  completed_non_cancelled: 1,
  active_panel: 6,
  total: 12,
};
const request = { version: 1, message: 'تعداد کل قراردادها؟', history: [] };
function setup({ status = 200, changeScope = false, rows = [row] } = {}) {
  const paths = [],
    audits = [];
  let modelCalls = 0,
    catalogs = 0;
  const agent = createDataAgent({
    enabled: true,
    erpBaseUrl: 'http://127.0.0.1:4301/api/v1',
    audit: (event) => audits.push(event),
    provider: {
      step: () => {
        modelCalls++;
        throw Error('MODEL_MUST_NOT_RUN');
      },
    },
    fetcher: async (url) => {
      paths.push(url);
      if (url.endsWith('/catalog')) {
        catalogs++;
        return Response.json(
          {
            version: 1,
            contextId: changeScope && catalogs > 3 ? 'b'.repeat(64) : contextId,
            sources: [
              {
                id: 'contracts',
                description: 'Current authorized contracts',
                columns: ['id'],
              },
            ],
            rules: [],
          },
          { status },
        );
      }
      return Response.json({
        version: 1,
        contextId,
        resultId,
        rows,
        columns: Object.keys(row),
        sources: ['contracts'],
        observedAt: '2026-11-16T10:00:00Z',
        truncated: false,
      });
    },
  });
  return {
    run: () =>
      agent(request, {
        cookie: 'nora_access=synthetic',
        signal: new AbortController().signal,
      }),
    paths,
    audits,
    get modelCalls() {
      return modelCalls;
    },
  };
}
test('exact total count uses fresh authorized native evidence with zero model calls and the total by default', async () => {
  const h = setup();
  const result = await h.run();
  assert.equal(h.modelCalls, 0);
  assert.equal(result.status, 'ANSWER');
  assert.match(result.text, /۱۲/);
  assert.doesNotMatch(result.text, /۷.*۲.*۳.*۱۲/);
  assert.equal(result.sources[0].resultId, resultId);
  assert.equal(
    h.paths.filter((path) => path.endsWith('/count-breakdown')).length,
    1,
  );
  assert.ok(h.paths.filter((path) => path.endsWith('/catalog')).length >= 4);
  assert.ok(
    h.audits.some(
      (event) => event.model === 'native-count' && event.totalTokens === 0,
    ),
  );
});
for (const status of [401, 403])
  test(`native route cannot bypass authentication/authorization ${status}`, async () => {
    const h = setup({ status });
    await assert.rejects(h.run());
    assert.equal(h.modelCalls, 0);
    assert.equal(h.paths.length, 1);
  });
test('native route fails closed on scope change or inconsistent source counts', async () => {
  for (const options of [
    { changeScope: true },
    { rows: [{ ...row, total: 100 }] },
  ])
    await assert.rejects(setup(options).run());
});
test('dates, qualifiers, context, history and ambiguous requests never use exact native route', () => {
  for (const input of [
    { ...request, message: 'تعداد کل قراردادها در این ماه' },
    { ...request, message: 'تعداد کل قراردادهای فعال' },
    { ...request, message: 'تعداد کل قراردادها و مبلغ فروش' },
    { ...request, message: 'تعداد کل قراردادهای شرکت دیگر' },
    { ...request, context: { selectedContractId: resultId } },
    { ...request, history: [{ role: 'user', content: 'فقط قراردادهای من' }] },
  ])
    assert.equal(nativeCountRoute(input), null);
});
