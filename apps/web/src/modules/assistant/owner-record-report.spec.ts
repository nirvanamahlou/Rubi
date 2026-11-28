import { it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { IAM_PERMISSION_CODES } from '@nora/contracts';
import { planQuestion } from './question-plan';
import { ownerRecordRequest } from './owner-record-intent';
import { runOwnerRecordReport } from './owner-record-report';
const actor = { permissions: [...IAM_PERMISSION_CODES], branchIds: ['west'] };
const context = { selection: 'ALL' };
it('routes each role reporting scenario to a data reader and preserves its qualifications', () => {
  const corpus = readFileSync(
    new URL(
      '../../../../../docs/assistant/role-report-acceptance.jsonl',
      import.meta.url,
    ),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { id: string; question: string });
  expect(new Set(corpus.map((row) => row.id)).size).toBe(220);
  const unrouted = corpus
    .filter((row) => {
      const plan = planQuestion(row.question);
      return (
        !plan.length ||
        plan.some((p) => p.kind === 'guide' || p.kind === 'unknown')
      );
    })
    .map((row) => row.id);
  expect(unrouted).toEqual([]);
});
it('uses the call-center branch inventory and carries the owner revision across pages', async () => {
  const q = 'فهرست تماس‌های نیازمند پیگیری رو بده';
  const read = vi
    .fn()
    .mockResolvedValueOnce({ data: [{ id: 'west' }] })
    .mockResolvedValueOnce({
      data: [{ call: { id: 'b', occurredAt: '2026-11-01T10:00:00Z' } }],
      meta: { total: 2, page: 1, revision: 'r1' },
    })
    .mockResolvedValueOnce({
      data: [{ call: { id: 'a', occurredAt: '2026-11-02T10:00:00Z' } }],
      meta: { total: 2, page: 2, revision: 'r1' },
    });
  const result = await runOwnerRecordReport(
    q,
    ownerRecordRequest(q)!,
    actor,
    context,
    read,
  );
  expect(result.status).toBe('answer');
  expect(result.text.indexOf('a —')).toBeLessThan(result.text.indexOf('b —'));
  expect(read).toHaveBeenLastCalledWith(
    '/customer-affairs/call-center/missed-callbacks',
    { page: 2, pageSize: 50, revision: 'r1' },
    'west',
  );
});
it('does not count a policy with an inaccessible contract as unassigned', async () => {
  const q = 'شرکت‌ها رو به ترتیب تعداد بیمه‌نامه‌های مسافرتی مرتب کن';
  const read = vi
    .fn()
    .mockResolvedValueOnce({
      page: 1,
      count: 1,
      data: [
        {
          id: 'p',
          branchId: 'west',
          contractId: 'hidden',
          contractNumber: 'H',
          policyNumber: null,
          status: 'ISSUED',
        },
      ],
    })
    .mockResolvedValueOnce({ data: [], meta: { page: 1, total: 0 } });
  const result = await runOwnerRecordReport(
    q,
    ownerRecordRequest(q)!,
    actor,
    context,
    read,
  );
  expect(result.status).toBe('partial');
  expect(result.text).not.toContain('بدون شرکت — ۱');
});
it('keeps the fiscal owner and journal status for an empty posted journal register', async () => {
  const q = 'الان تعداد سندهای قطعی حسابداری چنده؟';
  const read = vi.fn().mockResolvedValue({
    data: [],
    meta: { page: 1, total: 0, period: 'ALL' },
  });
  const result = await runOwnerRecordReport(
    q,
    ownerRecordRequest(q)!,
    actor,
    context,
    read,
  );
  expect(result.status).toBe('empty');
  expect(read).toHaveBeenCalledWith(
    '/finance/accounting/journal-register?status=POSTED&page=1',
  );
  expect(result.text).toContain('۰');
});
const sale = (id: string, company: string | null) => ({
  id,
  contractNumber: 'C' + id,
  branchId: 'west',
  settlementStatus: 'UNPAID',
  balances: [],
  issuerCompany: company ? { id: company, persianName: company } : null,
});
it.each([
  ['الان تعداد قراردادهای مشتری حقیقی چنده؟', 'personContracts', 'count'],
  [
    'فهرست مشتریان شخصی رو بده؛ اگه بیشتر از ده مورده ده مورد اول رو به ترتیب شناسه با تعداد کل نشون بده.',
    'customers',
    'list',
  ],
  [
    'شرکت‌ها رو به ترتیب تعداد قراردادهای آژانسی مرتب کن؛ تعداد هر شرکت رو هم بنویس.',
    'agencyContracts',
    'company',
  ],
  [
    'تعداد قراردادهای دارای خدمت هتل رو به تفکیک شعبه و در کل بده؛ موارد بدون شعبه چندتا هستن؟',
    'hotelContracts',
    'branch',
  ],
  [
    'کل بیمه‌نامه‌های مسافرتی ثبت‌شده چندتاست، چندتاش صادر شده و جمع مبلغ صادرشده‌ها چند ریاله؟',
    'insuranceSummary',
    'count',
  ],
])(
  'keeps the full subject and the requested shape: %s',
  (q, subject, shape) => {
    expect(ownerRecordRequest(q)).toMatchObject({ subject, shape });
    expect(planQuestion(q)).toEqual([{ kind: 'records', question: q }]);
  },
);
it.each([
  'الان تعداد قراردادهای مشتری حقیقی دیروز چنده؟',
  'چطور قرارداد مشتری حقیقی ثبت کنم؟',
  'فهرست بیمه‌نامه‌های ترکیه رو بده',
])('keeps additional qualifications in the general planner', (q) =>
  expect(ownerRecordRequest(q)).toBeNull(),
);
it('aggregates by issuer over every page, preserving a missing assignment', async () => {
  const q =
    'شرکت‌ها رو به ترتیب تعداد قراردادهای مشتری حقیقی مرتب کن؛ تعداد هر شرکت رو هم بنویس.';
  const read = vi
    .fn()
    .mockResolvedValueOnce({
      data: [sale('2', 'الف'), sale('3', null)],
      meta: { page: 1, total: 3 },
    })
    .mockResolvedValueOnce({
      data: [sale('1', 'الف')],
      meta: { page: 2, total: 3 },
    })
    .mockResolvedValueOnce({ data: [{ id: 'ب', persianName: 'ب' }] });
  const r = await runOwnerRecordReport(
    q,
    ownerRecordRequest(q)!,
    actor,
    context,
    read,
  );
  expect(read.mock.calls[0]?.[0]).toContain('customerType=IN_PERSON');
  expect(r.text).toContain('الف — ۲');
  expect(r.text).toContain('بدون شرکت — ۱');
});
it('refuses to report a total on an overlapping page', async () => {
  const q = 'الان تعداد قراردادهای فروش چنده؟';
  const read = vi
    .fn()
    .mockResolvedValueOnce({
      data: [sale('2', 'الف')],
      meta: { page: 1, total: 2 },
    })
    .mockResolvedValueOnce({
      data: [sale('2', 'الف')],
      meta: { page: 2, total: 2 },
    });
  await expect(
    runOwnerRecordReport(q, ownerRecordRequest(q)!, actor, context, read),
  ).rejects.toThrow('REPORT_LIST_CHANGED');
});
it('checks the authorized scope before reading', async () => {
  const q = 'الان تعداد حساب‌های کاربری فعال چنده؟';
  const read = vi.fn();
  const result = await runOwnerRecordReport(
    q,
    ownerRecordRequest(q)!,
    { ...actor, permissions: [] },
    context,
    read,
  );
  expect(result.status).toBe('denied');
  expect(read).not.toHaveBeenCalled();
});
it('lists the petty fund identifier separately from its branch', async () => {
  const question = 'فهرست حساب‌های تنخواه رو بده';
  const result = await runOwnerRecordReport(
    question,
    ownerRecordRequest(question)!,
    actor,
    context,
    vi.fn().mockResolvedValue({ id: 'fund-123', currencyCode: 'IRR' }),
  );
  expect(result.text).toContain('fund-123 —');
  expect(result.text).not.toContain('west —');
});
it('lists the receipt source identity from the connected finance queue', async () => {
  const question = 'فهرست دریافت‌های تأییدشده رو بده';
  const read = vi.fn().mockResolvedValue([
    {
      id: 'payment-1',
      contractId: 'contract-1',
      label: 'CNT-1',
      branch: 'west',
      confirmed: true,
    },
  ]);
  const answer = await runOwnerRecordReport(
    question,
    ownerRecordRequest(question)!,
    actor,
    context,
    read,
  );
  expect(answer.text).toContain('payment-1 —');
  expect(answer.text).not.toContain('sales:payment-1');
});
