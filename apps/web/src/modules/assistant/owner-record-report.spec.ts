import { it, expect, vi } from 'vitest';
import { IAM_PERMISSION_CODES } from '@nora/contracts';
import { planQuestion } from './question-plan';
import { ownerRecordRequest } from './owner-record-intent';
import { runOwnerRecordReport } from './owner-record-report';
const actor = { permissions: [...IAM_PERMISSION_CODES], branchIds: ['west'] };
const context = { selection: 'ALL' };
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
