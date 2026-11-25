import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { IAM_PERMISSION_CODES } from '@nora/contracts';
import { POST } from '../../app/api/assistant/v3/conversation/route';
import { planQuestion } from './question-plan';

const message =
  'فروش دو هفته اخیر چقدر بوده و اطلاعات قرارداد های این دو هفته رو بده و بهم بگو چطور قرارداد جدید بزنم؟';
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
  options: { salesStatus?: number; revoked?: boolean; limited?: boolean } = {},
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
          permissions: options.limited ? [] : actor.permissions,
          sessionId: options.revoked && reads > 1 ? 'changed' : 'session',
        });
      case '/legal-entities/context':
        return Response.json({ data: { version: 1, selection: 'ALL' } });
      case '/v3/assistant/conversation':
        return Response.json(sales, { status: options.salesStatus ?? 200 });
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
});
