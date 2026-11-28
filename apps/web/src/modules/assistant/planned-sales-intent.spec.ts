import { IAM_PERMISSION_CODES } from '@nora/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/assistant/v3/conversation/route';
import { planQuestion } from './question-plan';

const id = 'd2067cec-6f36-4aac-80ca-04eb40f34471';
const observedAt = '2026-11-25T19:00:00.000Z';
const questions = [
  ['تعداد مسافران را به تفکیک گروه سنی بگو.', ['passengers']],
  ['تعداد خدمات انتخاب شده را به تفکیک نوع بگو.', ['services']],
  [
    'پرداخت USD تأیید شده را جدا از معلق، ردشده و ابطال‌شده گزارش کن.',
    ['payments'],
  ],
  [
    'مبلغ USD و تعداد مسافر قرارداد TEST-2711 را بدون چند برابر کردن مبلغ بگو.',
    ['amounts', 'passengers'],
  ],
] as const;

async function converse(
  question: string,
  sources: readonly string[],
  options: { denied?: boolean; truncated?: boolean; selection?: string } = {},
) {
  const calls: string[] = [];
  const cookie = 'nora_access=test';
  vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(new Headers(init?.headers).get('cookie')).toBe(cookie);
    const target = new URL(String(url));
    if (target.pathname.startsWith('/sales/assistant-agent/')) {
      expect(target.origin).toBe('http://127.0.0.1:4301');
      expect(init?.method).toBe('GET');
      expect(init?.redirect).toBe('error');
    } else if (!target.pathname.startsWith('/v3/assistant/')) {
      expect(target.origin).toBe('http://localhost:4000');
    }
    switch (target.pathname) {
      case '/sales/assistant-agent/standard-sales-summary':
        calls.push('/standard-sales-summary');
        return Response.json({
          version: 1,
          metric: 'standard-sales',
          observedAt,
          total: 3,
          missingAmounts: 0,
          totals: [
            { currencyCode: 'USD', amount: '14.005' },
            { currencyCode: 'EUR', amount: '1.23' },
          ],
        });
      case '/sales/assistant-agent/my-contract-count':
        expect(new URL(String(url)).search).toBe('');
        expect(init?.body).toBeUndefined();
        calls.push('/my-contract-count');
        return Response.json({
          version: 1,
          ownership: 'mine',
          observedAt,
          total: 4,
          panelNonCancelled: 3,
        });
      case '/iam/auth/access':
        return Response.json({
          userId: 'sample',
          sessionId: 'session',
          branchIds: ['test'],
          permissions: options.denied ? [] : IAM_PERMISSION_CODES,
        });
      case '/legal-entities/context':
        return Response.json({
          data: { selection: options.selection ?? 'ALL', version: 1 },
        });
      case '/v3/assistant/conversation': {
        calls.push(JSON.parse(String(init?.body)).message);
        return Response.json({
          version: 3,
          status: 'ANSWER',
          text: 'synthetic evidence',
          requestId: id,
          plan: [],
          limitations: [],
          sources: [
            {
              resultId: id,
              observedAt,
              sources,
              truncated: options.truncated ?? false,
            },
          ],
        });
      }
      default:
        throw new Error('Unexpected reader');
    }
  });
  const response = await POST(
    new Request('http://test/api/assistant/v3/conversation', {
      method: 'POST',
      headers: {
        cookie,
        origin: 'http://test',
        'content-type': 'application/json',
        'x-nora-composition': '1',
      },
      body: JSON.stringify({ version: 3, message: question }),
    }),
  );
  expect(response.status).toBe(200);
  return { calls, parts: (await response.json()).parts };
}
beforeEach(() => {
  vi.stubEnv('NORA_ERP_API_BASE_URL', 'http://localhost:4000');
  vi.stubEnv('NORA_SALES_READ_API_BASE_URL', 'http://127.0.0.1:4301');
  vi.stubEnv('ASSISTANT_SERVICE_URL', 'http://localhost:4300');
  vi.stubEnv('ASSISTANT_AGENT_ENABLED', 'true');
  vi.stubEnv('NORA_MODEL_PLANNER_ENABLED', 'false');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('authorized multi-measure and grouped Sales requests', () => {
  it('reports an unavailable personal count when the read service is missing instead of sending the session to the full API', async () => {
    vi.stubEnv('NORA_SALES_READ_API_BASE_URL', '');
    const result = await converse('تعداد قراردادهای خودم چقدر است؟', []);
    expect(result.calls).toEqual([]);
    expect(result.parts[0].status).toBe('unavailable');
  });
  it('leaves standalone Tehran day counts on their native evidence path and retains a separate guidance request', () => {
    const days =
      'فروش امروز را با دیروز مقایسه کن، فقط تعداد قراردادها و بازه گزارش را بگو.';
    expect(planQuestion(days)).toEqual([]);
    const guidance = 'چطور قرارداد جدید بزنم؟';
    expect(planQuestion(days + ' و ' + guidance)).toEqual([
      { kind: 'sales', question: days },
      { kind: 'guide', question: guidance },
    ]);
    const grouped = 'تعداد قراردادهای امروز و دیروز به تفکیک وضعیت چقدر است؟';
    expect(planQuestion(grouped)).toEqual([
      { kind: 'sales', question: grouped },
    ]);
  });
  it('uses the same effective cancellation producer for standard counts and per-currency discounted amounts', async () => {
    const count = await converse(
      'تعداد قراردادهای فروش استاندارد در همه زمان‌ها بدون پیش‌نویس‌ها و لغوشده‌ها چقدر است؟',
      [],
    );
    const money = await converse(
      'جمع مبلغ فروش استاندارد USD در همه زمان‌ها با حذف لغوشده‌ها و پیش‌نویس‌ها چقدر است؟',
      [],
    );
    expect(count.calls).toEqual(['/standard-sales-summary']);
    expect(money.calls).toEqual(count.calls);
    expect(count.parts[0]).toMatchObject({
      status: 'answer',
      text: expect.stringContaining('۳'),
    });
    expect(money.parts[0]).toMatchObject({
      status: 'answer',
      text: expect.stringContaining('14.005 USD'),
    });
    expect(money.parts[0].text).not.toContain('EUR');
    const filtered = await converse(
      'تعداد قراردادهای فروش استاندارد فقط برای شعبه تهران چند تاست؟',
      [],
    );
    expect(filtered.parts[0].status).toBe('clarify');
    expect(filtered.calls).toEqual([]);
  });
  it('counts authenticated ownership, including cancellations, without sending an actor ID, and preserves unsupported filters', async () => {
    const report = await converse('تعداد قراردادهای خودم چقدر است؟', []);
    expect(report.calls).toEqual(['/my-contract-count']);
    expect(report.parts[0]).toMatchObject({
      status: 'answer',
      source: 'sales/assistant-agent/my-contract-count',
      observedAt,
    });
    expect(report.parts[0].text).toContain('۴');
    expect(report.parts[0].text).toContain('۳');
    const denied = await converse('تعداد قراردادهای من چنده؟', [], {
      denied: true,
    });
    expect(denied.parts[0].status).toBe('denied');
    expect(denied.calls).toEqual([]);
    const dated = await converse(
      'تعداد قراردادهای خودم در ماه قبل چقدر است؟',
      [],
    );
    expect(dated.parts[0].status).toBe('clarify');
    expect(dated.calls).toEqual([]);
    const allRequested =
      'با انتخاب همه شرکت‌ها، تعداد قراردادهای خودم چقدر است؟';
    expect((await converse(allRequested, [])).calls).toEqual([
      '/my-contract-count',
    ]);
    const single = await converse(allRequested, [], { selection: 'SINGLE' });
    expect(single.parts[0].status).toBe('clarify');
    expect(single.calls).toEqual([]);
  });
  it.each(questions)(
    'preserves the full grain and filters in %s',
    async (question, sources) => {
      const { calls, parts } = await converse(question, sources);
      expect(calls).toEqual([question]);
      expect(parts).toMatchObject([
        { question, status: 'answer', text: 'synthetic evidence', source: id },
      ]);
    },
  );
  it('preserves contract qualifiers on measures while releasing a separate workflow', () => {
    const data = 'مبلغ دلاری و تعداد مسافر قرارداد TEST-2711 را بگو';
    expect(planQuestion(data + ' و چطور قرارداد جدید بزنم؟')).toEqual([
      { kind: 'sales', question: data },
      { kind: 'guide', question: 'چطور قرارداد جدید بزنم؟' },
    ]);
    expect(
      planQuestion('چطور گزارش پرداخت‌ها را به تفکیک وضعیت بگیرم؟').some(
        (part) => part.kind === 'sales',
      ),
    ).toBe(false);
    expect(
      planQuestion('تعداد مسافران B2C را به تفکیک گروه سنی بگو.').some(
        (part) => part.kind === 'sales',
      ),
    ).toBe(false);
  });
  it('does not release a scalar from only one of the requested native sources', async () => {
    const { parts } = await converse(questions[3][0], [
      'contracts',
      'passengers',
    ]);
    expect(parts).toMatchObject([{ status: 'unavailable' }]);
    expect(parts[0].text).not.toContain('synthetic evidence');
  });
  it('marks truncated data and refuses an unauthorized actor before reading any report', async () => {
    expect(
      (await converse(questions[0][0], ['passengers'], { truncated: true }))
        .parts[0].status,
    ).toBe('partial');
    const result = await converse(questions[0][0], ['passengers'], {
      denied: true,
    });
    expect(result.parts).toMatchObject([{ status: 'denied' }]);
    expect(result.calls).toEqual([]);
  });
});
