import { expect, it, vi } from 'vitest';
import { runNativeReport } from './planned-native-report';

const report = {
  code: 'sales_by_organization',
  title: 'فروش بر اساس کارشناس',
  producerStatus: 'READY',
  approvedView: 'sales.reporting.contract-currency.v1',
};
const company = { selection: 'ALL' };
const at = '2026-11-24T20:40:00.000Z';
const result = {
  reportCode: report.code,
  sourceProjection: report.approvedView,
  total: 1,
  page: 1,
  pageSize: 5,
  generatedAtUtc: at,
  sourceDataAsOfUtc: null,
  rows: [
    {
      grainId: 'PRIVATE_ID',
      sourceValues: {
        primaryDimension: 'PRIVATE_PERSON',
        orderCount: 2,
        email: 'PRIVATE_EMAIL',
      },
    },
  ],
  columns: [
    { key: 'primaryDimension', kind: 'TEXT', label: 'کارشناس' },
    { key: 'orderCount', kind: 'NUMBER', label: 'تعداد قرارداد' },
    { key: 'salesAmount', kind: 'MONEY', label: 'مبلغ فروش' },
  ],
  totalsByCurrency: [
    { currencyCode: 'IRR', salesAmount: '120000000000000000.105' },
  ],
  filterSnapshot: {
    reportCode: report.code,
    timezone: 'Asia/Tehran',
    filters: {},
  },
};

it('runs the authenticated report with Tehran inclusive dates, typed safe output and the exact panel link', async () => {
  const filters = {
    fromUtc: '2026-11-24T20:30:00.000Z',
    toUtc: '2026-11-25T20:30:00.000Z',
    currencyCode: 'IRR',
  };
  const read = vi
    .fn()
    .mockResolvedValueOnce([report])
    .mockResolvedValueOnce({
      ...result,
      filterSnapshot: { ...result.filterSnapshot, filters },
    });
  const part = await runNativeReport(
    'گزارش فروش بر اساس کارشناس امروز با ارز IRR رو اجرا کن',
    company,
    read,
    new Date(at),
  );
  expect(read.mock.calls).toEqual([
    ['/reports/catalog'],
    [
      '/reports/sales_by_organization/query',
      { page: 1, pageSize: 5, timezone: 'Asia/Tehran', filters },
    ],
  ]);
  expect(part.status).toBe('answer');
  expect(part.text).toContain('120000000000000000.105 IRR');
  expect(part.text).toContain('تعداد قرارداد 2');
  expect(part.text).not.toContain('PRIVATE');
  expect(part.links[0]?.href).toContain(
    'report=sales_by_organization&from=2026-11-25&to=2026-11-25&currency=IRR',
  );
});

it('preserves the explicit company scope and rejects dropped filters or a different producer', async () => {
  for (const returned of [{ ...result, sourceProjection: 'other' }, result]) {
    const read = vi
      .fn()
      .mockResolvedValueOnce([report])
      .mockResolvedValueOnce(returned);
    const part = await runNativeReport(
      'گزارش RPT-001',
      { selection: 'JAHAN_BASTAN' },
      read,
    );
    expect(read.mock.calls[1]?.[1]).toMatchObject({
      legalEntityId: 'JAHAN_BASTAN',
    });
    expect(part.status).toBe('unavailable');
    expect(part.text).not.toContain('PRIVATE');
  }
});

it('does not query a hidden, ambiguous or unavailable report or discard unsupported qualifiers', async () => {
  for (const [entries, question] of [
    [[], report.title],
    [[report, { ...report, code: 'other_report' }], report.title],
    [[{ ...report, producerStatus: 'PENDING_CONNECTION' }], report.title],
    [[report], report.title + ' برای شعبه تهران'],
    [[report], report.title + ' از 2026-02-30 تا 2026-04-01'],
    [[report], report.title + ' از 2026-04-01 تا 2026-03-01'],
  ] as const) {
    const read = vi.fn().mockResolvedValueOnce(entries);
    const part = await runNativeReport('گزارش ' + question, company, read);
    expect(part.status).not.toBe('answer');
    expect(read).toHaveBeenCalledTimes(1);
  }
  const read = vi.fn();
  expect((await runNativeReport(report.title, null, read)).status).toBe(
    'unavailable',
  );
  expect(read).not.toHaveBeenCalled();
});

it('identifies a real empty result and never retries a denied query with broader scope', async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce([report])
    .mockResolvedValueOnce({
      ...result,
      total: 0,
      rows: [],
      totalsByCurrency: [],
    });
  expect(
    (await runNativeReport('گزارش ' + report.code, company, read)).status,
  ).toBe('empty');
  const denied = vi
    .fn()
    .mockResolvedValueOnce([report])
    .mockRejectedValueOnce(new Error('403'));
  await expect(runNativeReport(report.title, company, denied)).rejects.toThrow(
    '403',
  );
  expect(denied).toHaveBeenCalledTimes(2);
});
