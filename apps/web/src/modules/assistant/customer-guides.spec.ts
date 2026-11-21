import { describe, expect, it, vi } from 'vitest';
import type * as customerClient from '../customers/api/client';
import { CustomersApiError, customersApi } from '../customers/api/client';
import { readCustomerGuide, resolveCustomerQuestion } from './customer-guides';

vi.mock('../customers/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof customerClient>()),
  customersApi: { list: vi.fn(), detail: vi.fn() },
}));

const signal = new AbortController().signal;
const metrics = {
  kind: 'metrics',
  metric: 'all',
  externalFilters: false,
} as const;
const status = { kind: 'status', name: 'نام نمونه' } as const;
type Listing = Awaited<ReturnType<typeof customersApi.list>>;

describe('Customer panel guidance', () => {
  it.each([
    ['خط تیره نرخ بازگشت مشتری یعنی چی', 'metrics'],
    ['فیلتر شعبه مشتریان چطوریه', 'list'],
    ['چطور مشتری جدید ثبت کنم', 'register'],
    ['سوابق پرونده ۳۶۰ کجاست', 'history'],
    ['شماره تماس مشتری را کجا ببینم', 'contacts'],
    ['رضایت ارتباطی مشتری کجاست', 'consent'],
    ['همراه مشتری را از کجا اضافه کنم', 'companions'],
    ['پیشنهاد ادغام تکراری مشتری را کجا ثبت کنم', 'duplicate'],
    ['تاریخچه وضعیت پرونده کجاست', 'audit'],
    ['مدرک مشتری را کجا بارگذاری کنم', 'documents'],
    ['چطور مشتری را با فایل ادامه وارد کنم', 'import'],
    ['خروجی اکسل مشتریان از کجا بگیرم', 'export'],
  ])('routes %s and continues its topic', (question, id) => {
    expect(resolveCustomerQuestion(question, true)).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
    expect(resolveCustomerQuestion('بعدش چی؟', true, id)).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
  });
  it('leaves contract and Call Center questions to their guides', () => {
    expect(
      resolveCustomerQuestion('وضعیت قرارداد مشتری چیست؟', true),
    ).toBeUndefined();
    expect(
      resolveCustomerQuestion('تماس کال سنتر مشتری کجاست؟', true),
    ).toBeUndefined();
  });
  it('reads counts under the current filters without returning record data', async () => {
    const listing = {
      data: [{ displayName: 'private' }],
      meta: {
        metrics: {
          totalCustomers: 3,
          totalPassengers: 2,
          newCustomersLastThreeMonths: 1,
          returningCustomerRate: null,
        },
      },
    } as unknown as Listing;
    vi.mocked(customersApi.list).mockResolvedValue(listing);
    const result = await readCustomerGuide(
      metrics,
      new URLSearchParams('branchId=branch&createdFrom=2026-11-01'),
      signal,
    );
    expect(result.text).toContain('تعداد کل مشتریان ۳');
    expect(result.text).not.toContain('private');
    expect(customersApi.list).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 'branch',
        createdFrom: '2026-11-01',
      }),
      signal,
    );
    expect(
      (
        await readCustomerGuide(
          { ...metrics, metric: 'rate' },
          new URLSearchParams(),
          signal,
        )
      ).text,
    ).toContain('در دسترس نیست');
  });
  it('distinguishes absent and ambiguous records without leaking candidates', async () => {
    vi.mocked(customersApi.list).mockResolvedValue({
      data: [],
      meta: { total: 0 },
    } as unknown as Listing);
    expect(
      (await readCustomerGuide(status, new URLSearchParams(), signal)).text,
    ).toContain('پیدا نشد');
    vi.mocked(customersApi.list).mockResolvedValue({
      data: [{ displayName: 'نام نمونه', status: 'active' }],
      meta: { total: 2 },
    } as unknown as Listing);
    expect(
      (await readCustomerGuide(status, new URLSearchParams(), signal)).text,
    ).toContain('انتخاب کنید');
  });
  it.each([
    [401, 'دوباره وارد شوید'],
    [403, 'customers.read'],
    [500, 'دوباره تلاش کنید'],
  ])('separates API status %s', async (code, phrase) => {
    vi.mocked(customersApi.list).mockRejectedValue(
      new CustomersApiError('private', code),
    );
    expect(
      (await readCustomerGuide(metrics, new URLSearchParams(), signal)).text,
    ).toContain(phrase);
  });
});

it('reads only the selected authorized record status and passes cancellation to the API', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  vi.mocked(customersApi.detail).mockResolvedValue({
    data: { id, status: 'inactive', passportNumber: 'private' },
  } as Awaited<ReturnType<typeof customersApi.detail>>);
  const answer = await readCustomerGuide(
    { kind: 'status', name: undefined },
    new URLSearchParams({ customerId: id }),
    signal,
  );
  expect(answer.text).toBe('پرونده غیرفعال است.');
  expect(answer.href).toContain(id);
  expect(customersApi.detail).toHaveBeenCalledWith(id, undefined, signal);
});
