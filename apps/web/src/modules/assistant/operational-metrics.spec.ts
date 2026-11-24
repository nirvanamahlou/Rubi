import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readOperationalMetric,
  resolveOperationalMetric,
} from './operational-metrics';

describe('Nora operational reads', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1'));
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ['مجموع اضافه‌کاری کارکنان این هفته چقدره؟', 'employee-overtime'],
    ['روزهای کارکرد کارکنان امروز', 'employee-workdays'],
    ['تعداد اسناد صدور رزرواسیون این ماه', 'issued-documents'],
    ['تعداد اسناد آرشیو این هفته چقدره؟', 'document-count'],
    ['چند مشتری ثبت‌نام‌شده امروز', 'registered-customers'],
    ['تعداد درخواست‌های پشتیبانی مشتریان ماه جاری', 'support-ticket-count'],
    ['تعداد سرنخ‌های جدید امروز', 'new-leads'],
    ['مجموع دریافت‌های تأییدشده مشتریان این هفته', 'collected'],
    ['استردادهای قطعی مشتریان امروز', 'refunded'],
    ['تعداد خریدهای ثبت‌شده خدمات این ماه', 'registered-service-purchases'],
    [
      'تعداد تماس‌های منتسب به کارشناسان کال سنتر این هفته',
      'employee-call-count',
    ],
    [
      'تعداد تماس‌های متصل منتسب به کارشناسان کال سنتر امروز',
      'employee-connected-call-count',
    ],
    ['تعداد پیشنهادهای فعال بلیت با حرکت این ماه', 'active-offers'],
    ['تعداد کمپین‌های فعال بازاریابی', 'active-marketing-campaigns'],
    ['تعداد دفاتر حسابداری', 'accounting-books'],
    ['تعداد اسناد قطعی حسابداری این ماه', 'posted-accounting-journals'],
    ['تعداد درخواست‌های خرید و تامین', 'procurement-request-count'],
  ])('resolves %s to its native metric', (question, id) => {
    expect(resolveOperationalMetric(question)?.metric.id).toBe(id);
  });

  it.each([
    'چطور اضافه‌کاری کارکنان را ثبت کنم؟',
    'تعداد اسناد آرشیو این هفته شعبه تهران',
    'تعداد اسناد آرشیو هفته قبل',
    'تعداد اسناد صدور رزرواسیون امروز و دیروز',
    'پرفروش‌ترین هتل‌ها به تفکیک کشور',
    'تعداد کمپین‌های فعال بازاریابی این هفته',
  ])('leaves other questions to their regular route: %s', (question) => {
    expect(resolveOperationalMetric(question)).toBeNull();
  });

  const question = resolveOperationalMetric('اضافه کاری کارکنان این ماه')!;
  const snapshot = {
    version: 1,
    id: 'employee-overtime',
    range: 'month',
    scope: 'authorized',
    value: '۱۲٫۵',
  };

  it('loads only the requested aggregate and preserves its exact text', async () => {
    const load = vi.fn().mockResolvedValue(Response.json(snapshot));
    const signal = new AbortController().signal;
    const answer = await readOperationalMetric(question, 'ALL', signal, load);
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith(
      '/api/v1/reports/nora/metric?id=employee-overtime&range=month&aggregate=true',
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(answer).toContain('**۱۲٫۵ ساعت**');
  });

  it('respects the server scope decision and does not query without a period', async () => {
    const load = vi.fn().mockResolvedValue(
      Response.json({
        ...snapshot,
        scope: 'aggregate-required',
        value: null,
      }),
    );
    const signal = new AbortController().signal;
    await expect(
      readOperationalMetric(question, 'JAHAN_BASTAN', signal, load),
    ).resolves.toContain('همه شرکت‌ها');
    await expect(
      readOperationalMetric({ ...question, period: null }, 'ALL', signal, load),
    ).resolves.toContain('بازه را مشخص کنید');
    expect(load).toHaveBeenCalledOnce();
  });

  it('distinguishes restricted, unavailable and zero results', async () => {
    const signal = new AbortController().signal;
    const load = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ ...snapshot, value: null }))
      .mockResolvedValueOnce(Response.json({ ...snapshot, value: '۰' }));
    await expect(
      readOperationalMetric(question, 'ALL', signal, load),
    ).resolves.toContain('مجوز مشاهده');
    await expect(
      readOperationalMetric(question, 'ALL', signal, load),
    ).resolves.toContain('در دسترس نیست');
    await expect(
      readOperationalMetric(question, 'ALL', signal, load),
    ).resolves.toContain('**۰ ساعت**');
  });

  it('rejects a response from a cancelled conversation', async () => {
    const controller = new AbortController();
    const load = vi.fn(async () => {
      controller.abort();
      return Response.json(snapshot);
    });
    await expect(
      readOperationalMetric(question, 'ALL', controller.signal, load),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('keeps currency totals separate and labels organization scope', async () => {
    const read = resolveOperationalMetric('استردادهای قطعی مشتریان امروز')!;
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        version: 1,
        id: 'refunded',
        range: 'today',
        scope: 'organization',
        value: '۲٬۰۰۰ IRR · ۳ USD',
      }),
    );
    await expect(
      readOperationalMetric(
        read,
        'JAHAN_BASTAN',
        new AbortController().signal,
        fetcher,
      ),
    ).resolves.toContain('در کل سازمان، **۲٬۰۰۰ IRR · ۳ USD**');
  });
});
