import { describe, expect, it, vi } from 'vitest';
import type { DashboardProjectionSnapshot } from '@/modules/dashboard/model/projection-client';
import {
  readOperationalMetric,
  resolveOperationalMetric,
} from './operational-metrics';

describe('Nora operational reads', () => {
  it.each([
    ['مجموع اضافه‌کاری کارکنان این هفته چقدره؟', 'employee-overtime'],
    ['روزهای کارکرد کارکنان امروز', 'employee-workdays'],
    ['تعداد اسناد صدور رزرواسیون این ماه', 'issued-documents'],
    ['تعداد اسناد آرشیو این هفته چقدره؟', 'document-count'],
    ['چند مشتری ثبت‌نام‌شده امروز', 'registered-customers'],
    ['تعداد درخواست‌های پشتیبانی مشتریان ماه جاری', 'support-ticket-count'],
  ])('resolves %s to its native metric', (question, id) => {
    expect(resolveOperationalMetric(question)?.metric.id).toBe(id);
  });

  it.each([
    'چطور اضافه‌کاری کارکنان را ثبت کنم؟',
    'تعداد اسناد آرشیو این هفته شعبه تهران',
    'تعداد اسناد آرشیو هفته قبل',
    'تعداد اسناد صدور رزرواسیون امروز و دیروز',
    'پرفروش‌ترین هتل‌ها به تفکیک کشور',
  ])('leaves other questions to their regular route: %s', (question) => {
    expect(resolveOperationalMetric(question)).toBeNull();
  });

  const question = resolveOperationalMetric('اضافه کاری کارکنان این ماه')!;
  const snapshot = {
    state: 'ready',
    metadata: { reportVersion: 'reporting.dashboard.native.v1' },
    metrics: { 'employee-overtime': { value: '۱۲٫۵' } },
    visuals: {},
  } as unknown as DashboardProjectionSnapshot;

  it('loads only the requested aggregate and preserves its exact text', async () => {
    const load = vi.fn().mockResolvedValue(snapshot);
    const signal = new AbortController().signal;
    const answer = await readOperationalMetric(question, 'ALL', signal, {
      load,
    });
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntity: 'ALL',
        kpiIds: ['employee-overtime'],
        filters: expect.objectContaining({ range: 'month' }),
      }),
    );
    expect(answer).toContain('**۱۲٫۵ ساعت**');
  });

  it('does not request an aggregate for a single company or unspecified period', async () => {
    const load = vi.fn();
    const signal = new AbortController().signal;
    await expect(
      readOperationalMetric(question, 'JAHAN_BASTAN', signal, { load }),
    ).resolves.toContain('همه شرکت‌ها');
    await expect(
      readOperationalMetric({ ...question, period: null }, 'ALL', signal, {
        load,
      }),
    ).resolves.toContain('بازه را مشخص کنید');
    expect(load).not.toHaveBeenCalled();
  });

  it('distinguishes restricted, unavailable and zero results', async () => {
    const signal = new AbortController().signal;
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        ...snapshot,
        unavailableMetrics: {
          'employee-overtime': 'SOURCE_PERMISSION_REQUIRED',
        },
      })
      .mockResolvedValueOnce({ ...snapshot, metrics: {} })
      .mockResolvedValueOnce({
        ...snapshot,
        metrics: { 'employee-overtime': { value: '۰' } },
      });
    await expect(
      readOperationalMetric(question, 'ALL', signal, { load }),
    ).resolves.toContain('مجوز مشاهده');
    await expect(
      readOperationalMetric(question, 'ALL', signal, { load }),
    ).resolves.toContain('در دسترس نیست');
    await expect(
      readOperationalMetric(question, 'ALL', signal, { load }),
    ).resolves.toContain('**۰ ساعت**');
  });

  it('rejects a response from a cancelled conversation', async () => {
    const controller = new AbortController();
    const load = vi.fn(async () => {
      controller.abort();
      return snapshot;
    });
    await expect(
      readOperationalMetric(question, 'ALL', controller.signal, { load }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
