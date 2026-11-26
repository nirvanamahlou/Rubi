import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { IAM_PERMISSION_CODES } from '@nora/contracts';
import { POST } from '../../app/api/assistant/v3/conversation/route';
import { planQuestion } from './question-plan';

const message =
  'فروش دو هفته اخیر چقدر بوده و اطلاعات قرارداد های این دو هفته رو بده و بهم بگو چطور قرارداد جدید بزنم؟';
it('keeps both directory totals scoped to B2C when the label appears only once', () => {
  for (const question of [
    'تعداد کل مشتریان B2C و تعداد کل مسافران در همه شرکت‌ها چقدر است؟',
    'تعداد کل مشتریان و تعداد کل مسافران B2C چنده؟',
  ]) {
    expect(planQuestion(question)).toEqual([
      { kind: 'operational', question: 'تعداد کل مشتریان B2C' },
      { kind: 'operational', question: 'تعداد کل مسافران B2C' },
    ]);
  }
  expect(
    planQuestion('تعداد کل مشتریان B2C و تعداد کل مسافران پرواز امروز چنده؟'),
  ).not.toContainEqual({
    kind: 'operational',
    question: 'تعداد کل مسافران B2C',
  });
});

const cutoff = '2026-11-25T13:00:00.000Z';
const id = '5de3367e-308e-4de3-bc30-0683cfc144cd';
const actor = {
  userId: 'user',
  sessionId: 'session',
  permissions: IAM_PERMISSION_CODES,
  branchIds: ['a'],
};
const sales = {
  version: 3,
  status: 'ANSWER',
  text: 'synthetic',
  requestId: id,
  plan: [],
  limitations: [],
  sources: [
    {
      resultId: id,
      observedAt: cutoff,
      sources: ['contracts', 'amounts'],
      truncated: false,
    },
  ],
  reportParts: { summary: '150 EUR', contracts: 'C1, C2' },
  reportHref: '/sales?salesPeriodAsOf=' + encodeURIComponent(cutoff),
};
const send = (message: string, context = {}) =>
  POST(
    new Request('http://test/api/assistant/v3/conversation', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://test',
        'x-nora-composition': '1',
        cookie: 'nora_access=fixture',
      },
      body: JSON.stringify({ version: 3, message, ...context }),
    }),
  );
function serve(
  options: {
    salesStatus?: number;
    revoked?: boolean;
    limited?: boolean;
    ownRequests?: unknown;
    voucherPage?: {
      total: number;
      rows: { contractNumber: string; hotelName: string }[];
    };
  } = {},
) {
  let reads = 0;
  const mock = vi.fn(async (url: RequestInfo | URL, opts?: RequestInit) => {
    expect(new Headers(opts?.headers).get('cookie')).toBe(
      'nora_access=fixture',
    );
    switch (new URL(String(url)).pathname) {
      case '/iam/auth/access':
        reads++;
        return Response.json({
          ...actor,
          permissions: options.limited
            ? []
            : options.ownRequests
              ? [
                  ...actor.permissions,
                  'ui.profile',
                  'ui.screen.workbench.tab.requests',
                ]
              : actor.permissions,
          sessionId: options.revoked && reads > 1 ? 'changed' : 'session',
        });
      case '/legal-entities/context':
        return Response.json({ data: { version: 1, selection: 'ALL' } });
      case '/customer-affairs/workbench/requests/mine':
        return Response.json(options.ownRequests);
      case '/v3/assistant/conversation':
        return Response.json(sales, { status: options.salesStatus ?? 200 });
      case '/reports/nora/settled-vouchers':
        return Response.json({
          version: 1,
          observedAt: cutoff,
          total: 1,
          unknownStayCount: 1,
          rows: [{ contractNumber: 'S-1', hotelName: 'Hotel A' }],
          ...(options.voucherPage && {
            unknownStayCount: 0,
            ...options.voucherPage,
          }),
        });
      default:
        throw new Error('unexpected source');
    }
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
beforeEach(() => {
  vi.stubEnv('NORA_ERP_API_BASE_URL', 'http://localhost:4000');
  vi.stubEnv('ASSISTANT_SERVICE_URL', 'http://localhost:4300');
  vi.stubEnv('ASSISTANT_AGENT_ENABLED', 'true');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('composed v3 entry point', () => {
  it('attaches a company qualifier to the first data task without hiding a second instruction', () => {
    const scoped = 'با انتخاب همه شرکت‌ها، تعداد قراردادها را بگو';
    expect(planQuestion(scoped)).toEqual([]);
    const question = scoped + ' و چطور قرارداد جدید بزنم؟';
    expect(planQuestion(question)).toEqual([
      { kind: 'sales', question: scoped },
      { kind: 'guide', question: 'چطور قرارداد جدید بزنم؟' },
    ]);
  });
  it('marks voucher detail as partial when more than ten verified stays match', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      contractNumber: 'C' + i,
      hotelName: 'Hotel A',
    }));
    serve({ voucherPage: { total: 11, rows } });
    const question = 'کدام قراردادهای تسویه شده بدون واچر هستند؟';
    expect((await (await send(question)).json()).parts[0]).toMatchObject({
      status: 'partial',
      text: expect.stringContaining('۱۰ ردیف اول'),
    });
    serve({ voucherPage: { total: 11, rows: [] } });
    expect((await (await send(question)).json()).parts[0].status).toBe(
      'unavailable',
    );
  });
  it('shows the actual own request holder and approval stage for a real-format tracking code', async () => {
    const code = 'CA-T-2026-ABCDFFFF';
    const read = serve({
      ownRequests: {
        data: [
          {
            id,
            trackingNumber: code,
            direction: 'outgoing',
            subject: 'درخواست آزمایشی',
            status: 'NEW',
            leave: {},
            recipientName: 'مسئول نمونه',
            destinationUnit: 'منابع انسانی',
            progress: { managerApproved: true, hrApproved: false },
          },
        ],
        meta: { ownership: 'mine', hasMore: false },
      },
    });
    const { parts } = await (
      await send('درخواستم با کد پیگیری ca-t-۲۰۲۶-abcdffff الان دست کیه؟')
    ).json();
    expect(parts[0]).toMatchObject({
      status: 'answer',
      text: expect.stringContaining('مسئول نمونه'),
    });
    expect(parts[0].text).toContain('تأیید مدیر واحد: انجام‌شده');
    expect(
      read.mock.calls.some(([url]) =>
        String(url).endsWith('/mine?trackingNumber=' + code),
      ),
    ).toBe(true);
  });
  it('requires an unqualified unique own request and refuses an unscoped or truncated list', async () => {
    const read = serve({
      ownRequests: { data: [], meta: { ownership: 'mine', hasMore: true } },
    });
    expect(
      (await (await send('درخواستم در شعبه شیراز دیروز دست کیه؟')).json())
        .parts[0].status,
    ).toBe('clarify');
    expect(
      read.mock.calls.some(([url]) => String(url).includes('/requests/mine')),
    ).toBe(false);
    expect(
      (await (await send('درخواستم الان دست کیه؟')).json()).parts[0].status,
    ).toBe('clarify');
    serve({ ownRequests: { data: [] } });
    expect(
      (await (await send('درخواستم دست کیه؟')).json()).parts[0].status,
    ).toBe('unavailable');
  });
  it('serves all three requests from report and documented form in original order', async () => {
    const fetcher = serve();
    const res = await send(message);
    expect(res.status).toBe(200);
    const { parts } = await res.json();
    expect(parts.map((p: { status: string }) => p.status)).toEqual([
      'answer',
      'answer',
      'answer',
    ]);
    expect(parts[0].text).toBe('150 EUR');
    expect(parts[1].text).toBe('C1, C2');
    expect(parts[2].links).toContainEqual(
      expect.objectContaining({ href: '/assistant-guides/sales#create' }),
    );
    expect(
      fetcher.mock.calls.filter(([url]) =>
        String(url).endsWith('/v3/assistant/conversation'),
      ),
    ).toHaveLength(1);
  });
  it('retains the guide when the authorized sales reader is down', async () => {
    serve({ salesStatus: 503 });
    const body = await (await send(message)).json();
    expect(body.parts.at(-1).status).toBe('answer');
    expect(body.parts[0].status).toBe('unavailable');
  });
  it('discards all parts when session changes during execution', async () => {
    serve({ revoked: true });
    expect((await send(message)).status).toBe(409);
  });
  it('does not read sales when actor cannot view sales', async () => {
    const fetcher = serve({ limited: true });
    const { parts } = await (await send(message)).json();
    expect(parts[0].status).toBe('denied');
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).endsWith('/v3/assistant/conversation'),
      ),
    ).toBe(false);
  });
  it('keeps extra filters and identifiers attached to their question', () => {
    expect(planQuestion('درخواست من کجاست؟ کد پیگیری HR-123')).toEqual([]);
    expect(
      planQuestion(
        'فروش دو هفته اخیر شعبه شیراز چقدر بوده و چطور قرارداد جدید بزنم؟',
      )[0]?.question,
    ).toContain('شیراز');
  });
  it('uses the same temporal cutoff for an explicit follow-up, with fresh reads', async () => {
    const fetcher = serve();
    await send('فهرست قراردادهای همون دوره رو بده', {
      previous: message,
      salesPeriodAsOf: cutoff,
    });
    const call = fetcher.mock.calls.find(([url]) =>
      String(url).endsWith('/v3/assistant/conversation'),
    );
    expect(JSON.parse(String(call?.[1]?.body)).context).toEqual({
      salesPeriodAsOf: cutoff,
    });
  });
  it('does not return an all-time voucher report for a filtered request', async () => {
    const fetcher = serve();
    const { parts } = await (
      await send('کدام قراردادهای تسویه شده دیروز واچر ندارند؟')
    ).json();
    expect(parts[0].status).toBe('clarify');
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes('settled-vouchers'),
      ),
    ).toBe(false);
  });
  it('pairs the per-stay reconciliation with instructions for opening that exact report', async () => {
    serve();
    const { parts } = await (
      await send(
        'کدام قراردادهای تسویه‌شده هنوز واچر هتل ندارند و از کجا پیگیری کنم؟',
      )
    ).json();
    expect(parts[0]).toMatchObject({
      status: 'partial',
      source: 'reports/nora/settled-vouchers',
    });
    expect(parts[1]).toMatchObject({
      status: 'answer',
      source: '/assistant-guides/reservations#settled-vouchers',
    });
    expect(parts[1].links[0].href).toEqual(parts[0].links[0].href);
  });
  it('resolves the previous contract list and keeps filters on a qualified follow-up', () => {
    expect(planQuestion('همون قراردادها رو بده', message)[0]).toMatchObject({
      kind: 'rolling-sales',
      reuseSalesCutoff: true,
    });
    expect(planQuestion('همون قراردادها رو بده', '')).toEqual([]);
    expect(
      planQuestion('لیست قراردادهای همون دوره فقط شعبه شیراز', message)[0]
        ?.question,
    ).toContain('شیراز');
  });
  it('disables just the selected owner tools in a staged release', async () => {
    const fetcher = serve();
    vi.stubEnv('NORA_COMPOSITION_TOOLS', 'guide');
    const { parts } = await (await send(message)).json();
    expect(parts.map((p: { status: string }) => p.status)).toEqual([
      'unavailable',
      'answer',
    ]);
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes('/v3/assistant/conversation'),
      ),
    ).toBe(false);
  });
});
