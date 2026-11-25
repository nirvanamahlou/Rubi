import { expect, it, vi } from 'vitest';
import { IAM_PERMISSION_CODES } from '@nora/contracts';
import { runOperationalPanel } from './planned-operational';
import { isOperationalPanelQuestion } from './planned-operational-intent';
import { panelIntent } from './planned-operational-intent';

const first = '11111111-1111-4111-8111-111111111111',
  second = '22222222-2222-4222-8222-222222222222';
const actor = {
  permissions: [
    'legal-entity.aggregate.read',
    'customers.read',
    'b2b.agency.read',
    'master_data.read',
    'reservations.read',
    'customer_affairs.call_center.read',
  ],
  branchIds: [first, second],
};
const all = { selection: 'ALL' };

it('holds narrowed card questions while preserving other scoped workflows and the native dated call report', () => {
  for (const question of [
    'تعداد آژانس‌های همکار غیرفعال',
    'تعداد مشتریان B2C با نام علی',
    'تعداد تماس های امروز کال سنتر در شعبه شرق',
    'تو بازهٔ ۲۴ آبان ۱۴۰۵، تعداد تماسای بدون نتیجه شعبه غرب چقده؟',
    'وضعیت آژانس کد ABC در شعبه غرب چیه؟',
  ])
    expect(panelIntent(question)?.kind, question).toBe('unsupported');
  for (const question of [
    'وضعیت درخواست کال سنتر «آزمایش» دست کیه؟',
    'وضعیت خرید خدمات قرارداد S-123 چیه؟',
    'تو بازهٔ ۲۴ آبان ۱۴۰۵، تعداد تماسای بدون نتیجه چقده؟',
    'تعداد قراردادهای آژانس همکار',
  ])
    expect(panelIntent(question), question).toBeNull();
});
const native = (
  question: string,
  read: Parameters<typeof runOperationalPanel>[3],
) => runOperationalPanel(question, actor, all, read);

it('reads exact B2C panel card inputs and never returns directory row data', async () => {
  const read = vi.fn().mockResolvedValue({
    data: [{ personal: 'PRIVATE' }],
    meta: {
      metrics: {
        totalCustomers: 120,
        totalPassengers: 710,
        newCustomersLastThreeMonths: 5,
        returningCustomerRate: null,
      },
    },
  });
  for (const [q, value] of [
    ['تعداد مشتریان B2C چند تاست؟', '۱۲۰'],
    ['چند مسافر', null],
    ['تعداد مسافران B2C', '۷۱۰'],
    ['تعداد مشتریان جدید B2C سه ماه اخیر', '۵'],
  ] as const) {
    if (value === null) {
      expect(isOperationalPanelQuestion(q)).toBe(false);
      continue;
    }
    const r = await native(q, read);
    expect(r.status).toBe('answer');
    expect(r.text).toContain(value);
    expect(r.text).not.toContain('PRIVATE');
  }
  expect(read.mock.calls[0]?.[0]).toContain('/customers?');
  expect(read.mock.calls[0]?.[0]).toContain('pageSize=10');
  expect((await native('نرخ بازگشت مشتری B2C چقدره؟', read)).status).toBe(
    'unavailable',
  );
});

it('resolves an agency count or exact organization code only in the requested directory role', async () => {
  const read = vi.fn().mockResolvedValue({
    meta: { total: 1 },
    data: [
      {
        code: 'AG-12',
        resource: 'organizations',
        status: 'active',
        name: 'PRIVATE',
      },
    ],
  });
  expect((await native('تعداد آژانس های همکار', read)).text).toContain('۱');
  const result = await native('وضعیت آژانس همکار کد AG-12 چیه؟', read);
  expect(result.text).toContain('فعال است');
  expect(result.text).not.toContain('PRIVATE');
  expect(read.mock.calls[1]?.[0]).toContain('organizationRole=AGENCY');
  const ambiguous = vi.fn().mockResolvedValue({
    meta: { total: 40 },
    data: [{ code: 'AG-12', resource: 'organizations', status: 'active' }],
  });
  expect((await native('وضعیت آژانس کد AG-12', ambiguous)).status).toBe(
    'clarify',
  );
});

it('never reads the first near-match for a requested B2C name', async () => {
  const q = 'وضعیت پرونده مشتری B2C «نام آزمایشی» چیه؟';
  const read = vi.fn().mockResolvedValue({
    meta: { total: 1 },
    data: [{ status: 'active', displayName: 'نام آزمایشی دیگر' }],
  });
  expect((await native(q, read)).status).toBe('clarify');
  const found = vi.fn().mockResolvedValue({
    meta: { total: 1 },
    data: [{ status: 'inactive', displayName: 'نام آزمایشی' }],
  });
  expect((await native(q, found)).text).toContain('غیرفعال');
});

it('reads purchase summary from owner including unknown and fails if statuses do not reconcile', async () => {
  const summary = { total: 8, registered: 5, unregistered: 2, unknown: 1 };
  const read = vi.fn().mockResolvedValue({ meta: { summary } });
  expect((await native('تعداد کل خریدهای خدمات', read)).text).toContain('۸');
  expect(
    (await native('تعداد خریدهای خدمات با وضعیت نامشخص', read)).text,
  ).toContain('۱');
  expect(read.mock.calls[0]?.[0]).toContain(
    '/reservations/requests/purchases?kind=ALL',
  );
  read.mockResolvedValue({ meta: { summary: { ...summary, unknown: 0 } } });
  expect((await native('تعداد خریدهای ثبت شده', read)).status).toBe(
    'unavailable',
  );
});

it('resolves call-center branch like the panel and verifies the owner returned the same scope', async () => {
  const at = '2026-11-25T07:00:00.000Z';
  const list = {
    data: [{ id: first }, { id: second }],
    meta: { defaultBranchId: second },
  };
  const data = { today: 0, week: 88, withoutOutcome: 4, needsFollowUp: 1 };
  const read = vi
    .fn()
    .mockResolvedValueOnce(list)
    .mockResolvedValueOnce({
      data,
      meta: { branchId: second, timezone: 'Asia/Tehran', asOf: at },
    });
  expect(
    await native('تعداد تماس های این هفته کال سنتر چقدره؟', read),
  ).toMatchObject({
    status: 'answer',
    text: expect.stringContaining('۸۸'),
    observedAt: at,
  });
  expect(read.mock.calls).toEqual([
    ['/customer-affairs/call-center/branches', undefined, first],
    ['/customer-affairs/call-center/kpis', undefined, second],
  ]);
  const wrong = vi
    .fn()
    .mockResolvedValueOnce(list)
    .mockResolvedValueOnce({
      data,
      meta: { branchId: first, timezone: 'Asia/Tehran', asOf: at },
    });
  expect((await native('تعداد تماس های امروز کال سنتر', wrong)).status).toBe(
    'unavailable',
  );
});

it('cannot answer unsupported filters, inaccessible panels, or single-company questions with aggregate data', async () => {
  const read = vi.fn();
  expect(
    (
      await runOperationalPanel(
        'تعداد تماس های امروز کال سنتر',
        { permissions: IAM_PERMISSION_CODES, branchIds: [] },
        all,
        read,
      )
    ).status,
  ).toBe('denied');
  expect((await native('تعداد مشتریان B2C امروز', read)).status).toBe(
    'clarify',
  );
  expect(
    (
      await runOperationalPanel(
        'تعداد مشتریان B2C',
        actor,
        { selection: 'JAHAN_BASTAN' },
        read,
      )
    ).status,
  ).toBe('unavailable');
  expect(
    (
      await runOperationalPanel(
        'تعداد مشتریان B2C',
        { permissions: ['legal-entity.aggregate.read'], branchIds: [] },
        all,
        read,
      )
    ).status,
  ).toBe('denied');
  expect(
    (
      await runOperationalPanel(
        'تعداد مشتریان B2C',
        { permissions: ['customers.read'], branchIds: [] },
        all,
        read,
      )
    ).status,
  ).toBe('denied');
  expect(read).not.toHaveBeenCalled();
});
