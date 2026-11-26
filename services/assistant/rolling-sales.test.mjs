import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataAgent } from './data-agent.mjs';
import { rollingSalesRequest } from './rolling-sales.mjs';

const message = 'فروش دو هفته اخیر چقدر بوده و فهرست قراردادها را بده';
const id = '11111111-1111-4111-8111-111111111111';
const result = {
  version: 1,
  contextId: 'f'.repeat(64),
  resultId: id,
  observedAt: '2026-11-24T21:00:02.000Z',
  start: '2026-11-11T20:30:00.000Z',
  end: '2026-11-24T21:00:00.000Z',
  total: 1,
  missingAmounts: 0,
  totals: [{ currencyCode: 'USD', amount: '10.15' }],
  rows: [
    {
      number: 'S-1',
      customer: 'test',
      status: 'CONFIRMED',
      amounts: [{ currencyCode: 'USD', amount: '10.15' }],
    },
  ],
  truncated: false,
};
test('one native rolling report supplies both parts and the exact panel cutoff', async () => {
  const agent = createDataAgent({
    enabled: true,
    erpBaseUrl: 'http://127.0.0.1:4301/api/v1',
    fetcher: async (url, init) => {
      assert.ok(url.endsWith('/sales/assistant-agent/rolling-sales'));
      assert.equal(init.body, '{}');
      return Response.json(result);
    },
  });
  const out = await agent(
    { version: 1, message, history: [] },
    { cookie: 'nora_access=test', signal: new AbortController().signal },
  );
  assert.match(out.reportParts.contracts, /S-1/);
  assert.match(out.reportParts.summary, /۱۰\.۱۵ USD/);
  assert.equal(out.sources[0].resultId, id);
  assert.deepEqual(out.reportCoverage, {
    total: 1,
    listed: 1,
    missingAmounts: 0,
    truncated: false,
    currencyTotalsOmitted: false,
    rowCurrenciesOmitted: false,
  });
  assert.equal(
    new URL(out.reportHref, 'https://example.test').searchParams.get(
      'salesPeriodAsOf',
    ),
    result.end,
  );
});
test('rolling report recognizer preserves explicit filters and guide clauses', () => {
  assert.deepEqual(
    rollingSalesRequest({ message: 'لیست قراردادهای ۱۴ روز اخیر رو بده' }),
    { contracts: true },
  );
  assert.deepEqual(
    rollingSalesRequest({ message: 'فروش دو هفته اخیر چقدره؟' }),
    { contracts: false },
  );
  assert.deepEqual(
    rollingSalesRequest({
      message: 'فروش دو هفته اخیر چقدر بوده، قراردادهاش رو بده',
    }),
    { contracts: true },
  );
  assert.deepEqual(
    rollingSalesRequest({
      message: 'فروش دو هفته اخیر چقدر بوده، قراردادهاش رو فقط برای شیراز بده',
    }),
    { unsupported: true },
  );
  const grouped =
    'فروش دو هفته اخیر به تفکیک ارز چقدره و شماره و وضعیت قراردادهای همین بازه چیه؟';
  assert.deepEqual(rollingSalesRequest({ message: grouped }), {
    contracts: true,
  });
  assert.deepEqual(rollingSalesRequest({ message: grouped + ' فقط شیراز' }), {
    unsupported: true,
  });
  for (const text of ['فروش هفته گذشته', message + ' و بگو چطور قرارداد بزنم'])
    assert.equal(rollingSalesRequest({ message: text }), null);
});

test('unsupported period filters never drop to global SQL or issue an unfiltered native read', async () => {
  const agent = createDataAgent({
    enabled: true,
    erpBaseUrl: 'http://127.0.0.1:4301/api/v1',
    fetcher: () => assert.fail('unsupported filters must not query ERP'),
  });
  for (const message of [
    'فروش دو هفته اخیر شیراز',
    'فروش دو هفته اخیر نسبت به ماه قبل',
  ]) {
    const reply = await agent(
      { version: 1, message, history: [] },
      { cookie: 'nora_access=test', signal: new AbortController().signal },
    );
    assert.equal(reply.status, 'CLARIFY');
    assert.deepEqual(reply.sources, []);
  }
});

test('explicit previous period re-reads rows at the recorded cutoff and cannot scope another tool', async () => {
  const cutoff = result.end;
  const agent = createDataAgent({
    enabled: true,
    erpBaseUrl: 'http://127.0.0.1:4301/api/v1',
    fetcher: async (url, init) => {
      assert.ok(url.endsWith('/rolling-sales'));
      assert.deepEqual(JSON.parse(init.body), { salesPeriodAsOf: cutoff });
      return Response.json({ ...result, total: 0, rows: [], totals: [] });
    },
  });
  const input = {
    version: 1,
    message: 'فهرست قراردادهای همون دوره رو بده',
    history: [],
    context: { salesPeriodAsOf: cutoff },
  };
  const ctx = {
    cookie: 'nora_access=test',
    signal: new AbortController().signal,
  };
  const out = await agent(input, ctx);
  assert.match(out.reportParts.contracts, /پیدا نشد/);
  await assert.rejects(
    agent({ ...input, message: 'فروش دیروز' }, ctx),
    /INVALID_MESSAGE/,
  );
});
