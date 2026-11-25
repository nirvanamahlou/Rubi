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
  options: { denied?: boolean; truncated?: boolean } = {},
) {
  const calls: string[] = [];
  const cookie = 'nora_access=test';
  vi.stubGlobal('fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(new Headers(init?.headers).get('cookie')).toBe(cookie);
    switch (new URL(String(url)).pathname) {
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
        return Response.json({ data: { selection: 'ALL', version: 1 } });
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
  vi.stubEnv('ASSISTANT_SERVICE_URL', 'http://localhost:4300');
  vi.stubEnv('ASSISTANT_AGENT_ENABLED', 'true');
  vi.stubEnv('NORA_MODEL_PLANNER_ENABLED', 'false');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('authorized multi-measure and grouped Sales requests', () => {
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
