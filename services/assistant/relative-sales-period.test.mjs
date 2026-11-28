import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataAgent } from './data-agent.mjs';
import { resolveRelativeSalesPeriods } from './persian-sales-period.mjs';

const now = new Date('2026-11-22T06:00:00Z');
const ranges = (text, reference = now) =>
  resolveRelativeSalesPeriods(text, reference).map(({ startDate, endDate }) => [
    startDate,
    endDate,
  ]);

test('calendar weeks cross the Persian month boundary at Tehran midnight', () => {
  assert.deepEqual(ranges('این هفته نسبت به هفته قبل'), [
    ['2026-11-21', '2026-11-22'],
    ['2026-11-14', '2026-11-20'],
  ]);
  assert.deepEqual(ranges('هفته پیش نسبت به هفته قبل‌تر'), [
    ['2026-11-14', '2026-11-20'],
    ['2026-11-07', '2026-11-13'],
  ]);
  assert.deepEqual(ranges('این هفته', new Date('2026-11-20T20:29:59Z')), [
    ['2026-11-14', '2026-11-20'],
  ]);
  assert.deepEqual(ranges('این هفته', new Date('2026-11-20T20:30:00Z')), [
    ['2026-11-21', '2026-11-21'],
  ]);
  assert.deepEqual(ranges('این هفته میلادی'), [['2026-11-16', '2026-11-22']]);
  assert.deepEqual(ranges('٧ روز گذشته'), [['2026-11-15', '2026-11-21']]);
  assert.deepEqual(ranges('هفته قبل نسبت به هفته قبل'), []);
  assert.equal(
    resolveRelativeSalesPeriods('تا همین موقع هفته پیش', now)[0]
      .endExclusiveUtc,
    '2026-11-15T06:00:00.000Z',
  );
  assert.deepEqual(
    ranges('این سال نسبت به سال قبل', new Date('2025-03-21T09:00:00Z')),
    [
      ['2025-03-21', '2025-03-21'],
      ['2024-03-20', '2025-03-20'],
    ],
  );
});

test('Tehran civil days resolve independently of UTC midnight', () => {
  const before = new Date('2026-11-21T20:29:59.999Z');
  const midnight = new Date('2026-11-21T20:30:00.000Z');
  assert.deepEqual(ranges('امروز', before), [['2026-11-21', '2026-11-21']]);
  const [today, yesterday] = resolveRelativeSalesPeriods(
    'امروز نسبت به دیروز',
    midnight,
  );
  assert.equal(today.startDate, '2026-11-22');
  assert.equal(today.startUtc, today.endExclusiveUtc);
  assert.equal(yesterday.endExclusiveUtc, today.startUtc);
  assert.deepEqual(ranges('دیروز نسبت به پریروز'), [
    ['2026-11-21', '2026-11-21'],
    ['2026-11-20', '2026-11-20'],
  ]);
  assert.equal(
    resolveRelativeSalesPeriods('تا همین موقع دیروز', now)[0].endExclusiveUtc,
    '2026-11-21T06:00:00.000Z',
  );
});

test('agent applies exact half-open windows with a single clock and renders verified totals', async () => {
  const contextId = 'a'.repeat(64);
  const sources = ['contracts', 'amounts'];
  const sqls = [];
  let clockCalls = 0;
  const records = [
    ['2026-11-20T20:29:59.999Z', '10'],
    ['2026-11-20T20:30:00.000Z', '20'],
    ['2026-11-22T05:59:59.999Z', '5'],
    ['2026-11-22T06:00:00.000Z', '100'],
  ];
  const agent = createDataAgent({
    enabled: true,
    erpBaseUrl: 'http://127.0.0.1:4000/api/v1',
    now: () => {
      clockCalls++;
      return now;
    },
    fetcher: async (url, options) => {
      if (url.endsWith('/catalog'))
        return Response.json({
          version: 1,
          contextId,
          rules: [],
          sources: sources.map((id) => ({ id, description: id, columns: [] })),
        });
      const { sql } = JSON.parse(options.body);
      sqls.push(sql);
      const [, start, end] =
        /created_at >= '([^']+)'::timestamptz\s+AND created_at < '([^']+)'/.exec(
          sql,
        );
      const details = records
        .filter(([at]) => at >= start && at < end)
        .map(([at, amount], i) => ({
          kind: 2,
          contract_id: String(i),
          contract_number: String(i),
          status: 'CONFIRMED',
          created_at: at,
          currency_code: 'IRR',
          amount,
        }));
      const total = details.reduce((sum, row) => sum + BigInt(row.amount), 0n);
      return Response.json({
        version: 1,
        contextId,
        sources,
        resultId: '00000000-0000-4000-8000-00000000000' + sqls.length,
        observedAt: now.toISOString(),
        truncated: false,
        rows: [
          {
            kind: 0,
            metric: String(details.length),
            detail_rows: String(details.length),
            currencies: '1',
            missing_amounts: '0',
          },
          { kind: 1, currency_code: 'IRR', amount: String(total) },
          ...details,
        ],
      });
    },
  });
  const answer = await agent(
    {
      version: 1,
      message: 'فروش این هفته نسبت به هفته قبل چقدره؟',
      history: [],
    },
    { signal: new AbortController().signal },
  );
  assert.equal(answer.status, 'ANSWER');
  assert.equal(answer.sources.length, 2);
  assert.equal(clockCalls, 1);
  assert.match(answer.text, /بازهٔ ۱: ۲۵، بازهٔ ۲: ۱۰، اختلاف: ۱۵/);
  assert.match(answer.text, /دورهٔ ناقص/);
  const daily = await agent(
    {
      version: 1,
      message: 'فروش امروز نسبت به دیروز چقدره؟',
      history: [],
    },
    { signal: new AbortController().signal },
  );
  assert.equal(daily.status, 'ANSWER');
  assert.equal(daily.sources.length, 2);
  assert.equal(clockCalls, 2);
  assert.match(daily.text, /بازهٔ ۱: ۵، بازهٔ ۲: ۲۰، اختلاف: -۱۵/);
  assert.match(daily.text, /دورهٔ ناقص/);
  const previousWeek = await agent(
    {
      version: 1,
      message: 'فروش هفته پیشمون چقدر بوده',
      history: [],
    },
    { signal: new AbortController().signal },
  );
  assert.equal(previousWeek.status, 'ANSWER');
  assert.equal(previousWeek.sources.length, 1);
  assert.equal(clockCalls, 3);
  assert.match(previousWeek.text, /۱۰/);
  assert.match(sqls.at(-1), /2026-11-13T20:30:00\.000Z/);
  assert.match(sqls.at(-1), /2026-11-20T20:30:00\.000Z/);
});
