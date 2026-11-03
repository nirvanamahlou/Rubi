import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IntegrationRegistryV1 } from '@nora/contracts';
import type { SiteReport } from './api/client';
import { aggregateSiteMetric, type SiteReportResult } from './report-model';
import { BrandsDashboard } from './components/brands-dashboard';
import { SiteVisits } from './components/site-report';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://nora.example/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
const from = '2026-11-01',
  to = '2026-11-03';
const ids = ['first', 'second', 'third', 'academy'];
function source(id: string, count: number): SiteReport {
  return {
    schemaVersion: 1,
    registrySystemId: id,
    environment: 'PRODUCTION',
    checkedAt: to + 'T10:00:00Z',
    from,
    to,
    metrics: Object.fromEntries(
      ['sales', 'orders', 'users', 'pending'].map((metric) => [
        metric,
        { value: count, state: 'AVAILABLE' },
      ]),
    ),
    totals: {},
    salesByCurrency: [
      { currency: 'IRT', amount: String(count) + '.25', complete: true },
    ],
    trends: {},
    visits: {
      available: true,
      pageViews: 0,
      uniqueBrowsers: 0,
      daily: [],
      definition: 'anonymous',
    },
    activity: [],
    activityAvailable: false,
  };
}
function results(
  reports = ids.map((id, index) => source(id, index + 1)),
): Record<string, SiteReportResult> {
  return Object.fromEntries(
    reports.map((report) => [
      report.registrySystemId!,
      { state: 'available', report },
    ]),
  );
}
describe('Aggregate Integrations dashboard facts', () => {
  it('sums all four sites and all period counters, including an education source', () => {
    for (const metric of ['orders', 'users', 'pending'] as const)
      expect(
        aggregateSiteMetric(ids, results(), from, to, metric),
      ).toMatchObject({ text: '۱۰', covered: 4, total: 4, complete: true });
    expect(
      aggregateSiteMetric(ids, results(), from, to, 'sales'),
    ).toMatchObject({ text: '۱۱ IRT', complete: true });
  });
  it('adds exact fractional amounts above the JS integer limit and keeps currencies separate', () => {
    const reports = ids.map((id) => source(id, 1));
    ['9007199254740993.125', '0.875', '1.10', '0.90'].forEach(
      (amount, index) => {
        reports[index]!.salesByCurrency![0]!.amount = amount;
      },
    );
    reports[0]!.salesByCurrency!.push({
      currency: 'USD',
      amount: '7.10',
      complete: true,
    });
    reports[1]!.salesByCurrency!.push({
      currency: 'USD',
      amount: '0.90',
      complete: true,
    });
    expect(
      aggregateSiteMetric(ids, results(reports), from, to, 'sales').text,
    ).toBe('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۶ IRT / ۸ USD');
  });
  it('never presents unavailable sources as zero or a complete four-site total', () => {
    const partial = results([source(ids[0]!, 0)]);
    partial[ids[1]!] = { report: null, state: 'forbidden' };
    partial[ids[2]!] = { report: null, state: 'error' };
    partial[ids[3]!] = { report: null, state: 'unconfigured' };
    expect(aggregateSiteMetric(ids, partial, from, to, 'orders')).toMatchObject(
      { text: '۰', covered: 1, complete: false },
    );
    expect(aggregateSiteMetric(ids, {}, from, to, 'orders')).toMatchObject({
      text: 'داده موجود نیست',
      covered: 0,
      complete: false,
    });
  });
  it('rejects stale periods, mismatched bindings and forbidden metric values', () => {
    const reports = ids.map((id) => source(id, 10));
    reports[0]!.to = '2026-11-02';
    reports[1]!.registrySystemId = 'wrong';
    reports[2]!.metrics.orders = { value: 999, state: 'FORBIDDEN' };
    const rows = results(reports);
    rows[ids[1]!] = rows.wrong!;
    expect(aggregateSiteMetric(ids, rows, from, to, 'orders')).toMatchObject({
      text: '۱۰',
      covered: 1,
      included: ['academy'],
    });
    expect(
      aggregateSiteMetric(ids, results(), '2026-11-02', to, 'orders').covered,
    ).toBe(0);
  });
  it('excludes incomplete source money without hiding its permitted counters', () => {
    const reports = ids.map((id) => source(id, 1));
    reports[0]!.salesByCurrency![0]!.complete = false;
    reports[1]!.salesByCurrency = null;
    reports[2]!.salesByCurrency![0]!.amount = '1e6';
    expect(
      aggregateSiteMetric(ids, results(reports), from, to, 'sales'),
    ).toMatchObject({ text: '۱٫۲۵ IRT', covered: 1, complete: false });
    expect(
      aggregateSiteMetric(ids, results(reports), from, to, 'orders').covered,
    ).toBe(4);
  });
  it('deduplicates registry IDs and preserves large count sums exactly', () => {
    const reports = ids
      .slice(0, 2)
      .map((id) => source(id, Number.MAX_SAFE_INTEGER));
    expect(
      aggregateSiteMetric(
        [ids[0]!, ids[1]!, ids[0]!],
        results(reports),
        from,
        to,
        'users',
      ),
    ).toMatchObject({ text: '۱۸٬۰۱۴٬۳۹۸٬۵۰۹٬۴۸۱٬۹۸۲', covered: 2, total: 2 });
  });
  it('does not infer a sale from nonzero activation counts without recorded amounts', () => {
    const report = source(ids[0]!, 1);
    report.salesByCurrency = [];
    expect(
      aggregateSiteMetric(ids, results([report]), from, to, 'sales').covered,
    ).toBe(0);
    report.metrics.sales = { value: 0, state: 'AVAILABLE' };
    expect(
      aggregateSiteMetric(ids, results([report]), from, to, 'sales'),
    ).toMatchObject({ text: '۰ · بدون فروش', covered: 1 });
  });
});

describe('Owner dashboard layout', () => {
  it('renders four compact visit cards, global KPIs and independent tracking/trend selectors without removed panels', () => {
    const registry = {
      contract: 'integrations.registry.v1',
      schemaVersion: 1,
      branchId: 'branch',
      version: 1,
      brands: ids.map((id) => ({
        id,
        code: id,
        name: id,
        lifecycle: 'ENABLED',
      })),
      systems: ids.map((id) => ({
        id,
        brandId: id,
        code: id,
        name: id,
        kind: 'Website',
        businessDomain: id === 'academy' ? 'EDUCATION' : 'TRAVEL',
        lifecycle: 'ENABLED',
        capabilityCodes: [],
      })),
      capabilities: [],
      initialized: true,
      canManage: true,
      connectionState: 'NOT_CONFIGURED',
      counts: { brands: 4, systems: 4, awaitingConnection: 4 },
      lastChange: null,
    } as IntegrationRegistryV1;
    const html = renderToStaticMarkup(
      <BrandsDashboard
        data={registry}
        onOpen={() => {}}
        onSection={() => {}}
        onManage={() => {}}
      />,
    );
    expect(html).toContain('aria-label="آمار مجموع سایت‌ها"');
    expect(html).toContain('aria-label="سایت نمودار روند"');
    expect(html).toContain('aria-label="سایت حضور زنده"');
    expect(html.match(/بازدیدکننده یکتا/g)).toHaveLength(4);
    for (const removed of [
      'جریان یکپارچه در ERP',
      'عملیات نیازمند اقدام',
      'تعریف شاخص‌های سایت',
      'مقایسه عملکرد سامانه‌ها',
      'نقشه دسته‌بندی‌شده سایت',
    ])
      expect(html).not.toContain(removed);
  });
  it('keeps compact measured zero and capture coverage distinct from unavailable analytics', () => {
    const report = source(ids[0]!, 1);
    report.visits.coverageFrom = from + 'T12:00:00Z';
    const measured = renderToStaticMarkup(
      <SiteVisits
        compact
        report={report}
        siteName="site"
        label="period"
        loading={false}
      />,
    );
    expect(measured).toContain('<strong>۰</strong>');
    expect(measured).toMatch(/<details[^>]*><summary>جزئیات بازدید<\/summary>/);
    expect(measured).toContain('پیش از آن سابقه‌ای ثبت نشده است');
    const absent = renderToStaticMarkup(
      <SiteVisits
        compact
        report={null}
        siteName="site"
        label="period"
        loading={false}
        state="forbidden"
      />,
    );
    expect(absent).toContain('دسترسی گزارش فعال نیست');
    expect(absent).not.toContain('<strong>۰</strong>');
  });
});
