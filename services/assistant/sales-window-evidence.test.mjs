import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePersianSalesPeriod,
  normalizeSalesText,
} from './persian-sales-period.mjs';
import {
  salesWindowRequest,
  salesWindowSql,
  validateSalesWindow,
  renderSalesWindow,
} from './sales-window-evidence.mjs';
import { createDataAgent } from './data-agent.mjs';
const now = new Date('2026-11-17T08:00:00Z');
const question =
  'فروشمون از ۲۰ آبان تا ۲۳ آبان امسال چقدر بوده و تعداد قراردادها و شماره قراردادها و اطلاعاتشان را بده.';
const request = salesWindowRequest({ message: question }, now);
const id = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb';
const rows = [
  {
    kind: 0,
    metric: '2',
    detail_rows: '3',
    currencies: '2',
    missing_amounts: '0',
  },
  { kind: 1, currency_code: 'USD', amount: '80.1250' },
  { kind: 1, currency_code: 'IRR', amount: '9007199254740993.0000' },
  {
    kind: 2,
    contract_id: 'synthetic-a',
    contract_number: 'SYN-A',
    customer_name: 'نمونه الف',
    status: 'CONFIRMED',
    created_at: '2026-11-11T09:00:00Z',
    currency_code: 'USD',
    amount: '80.1250',
  },
  {
    kind: 2,
    contract_id: 'synthetic-a',
    contract_number: 'SYN-A',
    customer_name: 'نمونه الف',
    status: 'CONFIRMED',
    created_at: '2026-11-11T09:00:00Z',
    currency_code: 'IRR',
    amount: '9007199254740900.0000',
  },
  {
    kind: 2,
    contract_id: 'synthetic-b',
    contract_number: 'SYN-B',
    customer_name: 'نمونه ب',
    status: 'COMPLETED',
    created_at: '2026-11-12T09:00:00Z',
    currency_code: 'IRR',
    amount: '93.0000',
  },
];
const result = {
  version: 1,
  contextId: 'a'.repeat(64),
  resultId: id,
  columns: ['kind'],
  sources: ['contracts', 'amounts'],
  rows,
  truncated: false,
  observedAt: now.toISOString(),
};
const final = {
  status: 'ANSWER',
  text: '[[sales:summary:table]]\n[[sales:details:list]]\n[[sales:method]]',
  resultIds: [id],
  limitations: [],
  calculationExplanation: null,
};
test('20–23 Aban1405 resolves independently to inclusive11–14November with Tehran half-open UTC boundaries', () => {
  assert.deepEqual(request.period, {
    calendar: 'persian',
    timeZone: 'Asia/Tehran',
    year: 1405,
    startDay: 20,
    startMonth: 'آبان',
    endDay: 23,
    endMonth: 'آبان',
    startDate: '2026-11-11',
    endDate: '2026-11-14',
    startUtc: '2026-11-10T20:30:00.000Z',
    endExclusiveUtc: '2026-11-14T20:30:00.000Z',
  });
  assert.equal(normalizeSalesText('٢٠ آبان\u200c ۱۴۰۵'), '20 آبان 1405');
  assert.equal(
    resolvePersianSalesPeriod(
      'از ۲۰ آبان تا ۲۳ آبان ۱۴۰۵',
      new Date('2027-01-01'),
    ).startDate,
    '2026-11-11',
  );
  assert.equal(
    resolvePersianSalesPeriod(
      'از ۱ فروردین تا ۱ فروردین امسال',
      new Date('2026-03-20T21:00:00Z'),
    ).year,
    1405,
  );
});
test('Persian leap days and impossible/reversed dates fail explicitly', () => {
  assert.equal(
    resolvePersianSalesPeriod('۲۹ اسفند تا ۳۰ اسفند ۱۴۰۳', now).endDate,
    '2025-03-20',
  );
  for (const q of [
    '۳۰ اسفند تا ۳۰ اسفند ۱۴۰۴',
    '۳۲ آبان تا ۳۲ آبان ۱۴۰۵',
    '۲۳ آبان تا ۲۰ آبان ۱۴۰۵',
  ])
    assert.throws(() => resolvePersianSalesPeriod(q, now));
  assert.equal(resolvePersianSalesPeriod('این ماه چقدر فروختیم؟', now), null);
});
test('explicit filtered or unavailable metric never gets certified as unfiltered report', () => {
  for (const filter of [
    'کارشناس',
    'مقصد',
    'آژانس',
    'خالص',
    'استرداد',
    'تسویه',
    'مشتری',
    'شعبه',
    'مقایسه',
  ])
    assert.equal(
      salesWindowRequest({ message: question + ' ' + filter }, now),
      null,
    );
});
test('same-snapshot reconciliation counts identities, groups exact discounted amounts and excludes non-sales statuses', () => {
  const sql = salesWindowSql(request.period, now.toISOString());
  assert.match(sql, /count\(DISTINCT id\)/);
  assert.match(sql, /GROUP BY currency_code/);
  assert.match(sql, /created_at >= '2026-11-10T20:30:00.000Z'/);
  assert.match(sql, /created_at < '2026-11-14T20:30:00.000Z'/);
  assert.doesNotMatch(
    sql,
    /DRAFT|PENDING_CONFIRMATION|CANCELLED|payments|passengers/,
  );
  assert.throws(() =>
    salesWindowSql(
      { ...request.period, startUtc: "';DROP" },
      now.toISOString(),
    ),
  );
  const report = validateSalesWindow(result);
  const text = renderSalesWindow(final, report, request);
  assert.match(text, /قراردادهای یکتا \| ۲/);
  assert.match(text, /۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳/);
  assert.match(text, /تخفیف‌های قراردادی از قبل کسر/);
  assert.doesNotMatch(text, /CONFIRMED|SENT_TO|nora_agent/);
});
test('old three-currency-row count, wrong calendar and unsupported free prose cannot escape fact binding', () => {
  const report = validateSalesWindow(result);
  for (const text of [
    '۳ قرارداد در ۱۰ تا ۱۳ نوامبر ثبت شد',
    '[[sales:summary:table]]\n۳ قرارداد\n[[sales:details:list]]\n[[sales:method]]',
    '[[sales:summary:table]]',
  ])
    assert.throws(
      () => renderSalesWindow({ ...final, text }, report, request),
      /SALES_FACT_BINDING_REQUIRED/,
    );
  for (const layout of ['table', 'list', 'prose'])
    assert.match(
      renderSalesWindow(
        {
          ...final,
          text: `[[sales:summary:${layout}]]\n[[sales:details:table]]\n[[sales:method]]`,
        },
        report,
        request,
      ),
      /قراردادهای یکتا/,
    );
});
test('incomplete summary or contradictory distinct count is rejected; truncated detail has explicit coverage', () => {
  assert.throws(() =>
    validateSalesWindow({
      ...result,
      rows: rows.filter((r) => r.currency_code !== 'USD'),
    }),
  );
  assert.throws(() =>
    validateSalesWindow({
      ...result,
      rows: [{ ...rows[0], metric: '3' }, ...rows.slice(1)],
    }),
  );
  const report = validateSalesWindow({
    ...result,
    truncated: true,
    rows: rows.slice(0, 4),
  });
  assert.match(
    renderSalesWindow(final, report, request),
    /فهرست جزئیات کامل نیست/,
  );
});
test('zero is evidence-backed; missing amounts are not silently zero-valued contracts', () => {
  const empty = validateSalesWindow({
    ...result,
    rows: [
      {
        kind: 0,
        metric: '0',
        detail_rows: '0',
        currencies: '0',
        missing_amounts: '0',
      },
    ],
  });
  assert.match(
    renderSalesWindow(final, empty, request),
    /قراردادی با این معیارها یافت نشد/,
  );
  const missing = validateSalesWindow({
    ...result,
    rows: [
      {
        kind: 0,
        metric: '1',
        detail_rows: '1',
        currencies: '0',
        missing_amounts: '1',
      },
      { ...rows[3], amount: null, currency_code: null },
    ],
  });
  assert.match(
    renderSalesWindow(final, missing, request),
    /مبلغی در منبع وجود ندارد/,
  );
});
function harness({
  badFirst = false,
  revoke = false,
  oracleUnavailable = false,
} = {}) {
  let n = 0,
    posts = 0,
    catalogs = 0;
  const sent = [];
  const catalog = {
    version: 1,
    contextId: result.contextId,
    rules: [],
    sources: [
      { id: 'contracts', description: 'Synthetic', columns: ['id'] },
      { id: 'amounts', description: 'Synthetic', columns: ['amount'] },
    ],
  };
  const provider = {
    step: async (messages) => {
      sent.push(structuredClone(messages));
      const steps = [
        ['set_plan', { steps: ['بررسی فروش'] }],
        ['catalog_describe', { source: 'amounts' }],
        ['database_query', { sql: 'SELECT count(*) FROM contracts' }],
        [
          'finish_answer',
          badFirst ? { ...final, text: '۳ قرارداد، بدون کسر تخفیف' } : final,
        ],
        ['finish_answer', final],
      ];
      const [name, args] = steps[n++];
      return { id: 'step' + n, name, args, tokens: 10 };
    },
  };
  const agent = createDataAgent({
    enabled: true,
    now: () => now,
    provider,
    erpBaseUrl: 'http://127.0.0.1:4301/api/v1',
    fetcher: async (url, opts) => {
      if (url.endsWith('catalog')) {
        catalogs++;
        return revoke && posts === 2
          ? new Response('', { status: 403 })
          : Response.json(catalog);
      }
      posts++;
      assert.equal(JSON.parse(opts.body).contextId, result.contextId);
      if (posts === 2 && oracleUnavailable)
        return new Response('', { status: 503 });
      return Response.json(
        posts === 2
          ? result
          : {
              ...result,
              resultId: 'cccccccc-cccc-4ccc-accc-cccccccccccc',
              sources: ['contracts'],
              rows: [{ count: '3' }],
            },
      );
    },
  });
  return { agent, sent, counts: () => ({ posts, catalogs }) };
}
test('real orchestration passes model SQL then trusted fresh reconciliation to model; repair never repeats SQL', async () => {
  const h = harness({ badFirst: true });
  const answer = await h.agent(
    { version: 1, message: question, history: [] },
    { cookie: 'synthetic', signal: new AbortController().signal },
  );
  assert.equal(answer.status, 'ANSWER');
  assert.match(answer.text, /قراردادهای یکتا \| ۲/);
  assert.equal(h.counts().posts, 2);
  assert.equal(h.sent.length, 5);
  assert.match(JSON.stringify(h.sent.at(-1)), /verifiedSalesReport/);
  assert.equal(answer.sources.at(-1).resultId, id);
  assert.doesNotMatch(answer.text, /\[\[sales:/);
});
test('financial reconciliation never releases stale authorization or substitutes source outage with zero', async () => {
  for (const mode of [{ revoke: true }, { oracleUnavailable: true }]) {
    const h = harness(mode);
    await assert.rejects(
      h.agent(
        { version: 1, message: question, history: [] },
        { cookie: 'synthetic', signal: new AbortController().signal },
      ),
      /FORBIDDEN|AGENT_SOURCE_UNAVAILABLE/,
    );
  }
});
