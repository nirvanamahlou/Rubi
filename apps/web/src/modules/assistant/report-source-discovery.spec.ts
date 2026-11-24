import { expect, it, vi } from 'vitest';
import {
  describeReportSources,
  reportSourceTopic,
} from './report-source-discovery';
import {
  resolveOperationalMetric,
  readOperationalMetric,
} from './operational-metrics';

it('recognizes explicit source searches separately from requests for business values', () => {
  expect(reportSourceTopic('برای اضافه‌کاری کدام گزارش را ببینم؟')).toBe(
    'اضافه کاری',
  );
  expect(reportSourceTopic('منبع دادهٔ فروش کجاست؟')).toBe('فروش');
  expect(reportSourceTopic('اضافه‌کاری کارکنان امروز چقدره؟')).toBeNull();
});
it('ranks only native ready reports returned for the current user', async () => {
  const available = {
    code: 'overtime',
    title: 'اضافه‌کاری کارکنان',
    producerStatus: 'READY',
  };
  const pending = {
    ...available,
    title: 'اضافه‌کاری خصوصی',
    producerStatus: 'PENDING_CONNECTION',
  };
  expect(
    await describeReportSources('اضافه کاری', [available, pending]),
  ).toContain(available.title);
  expect(await describeReportSources('اضافه کاری', [pending])).not.toContain(
    pending.title,
  );
  expect(await describeReportSources('اضافه کاری', [])).toContain('پیدا نشد');
  await expect(describeReportSources('اضافه کاری', [{}])).rejects.toThrow();
});
it('reads only native catalog metadata on the chat path', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/api/v1');
  try {
    const fetcher = vi.fn().mockResolvedValue(Response.json([]));
    const request = resolveOperationalMetric(
      'برای اضافه کاری کدام گزارش را ببینم؟',
    )!;
    expect(
      await readOperationalMetric(
        request,
        undefined,
        new AbortController().signal,
        fetcher,
      ),
    ).toContain('پیدا نشد');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/reports/catalog',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  } finally {
    vi.unstubAllEnvs();
  }
});
