import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { integrationsApi, type SiteReport } from './api/client';
import { localizedFetch } from '@/i18n/localized-fetch';
import {
  reportMetricText,
  scopedSiteReport,
  dailySeries,
} from './report-model';
import { SiteVisits, SiteActivity } from './components/site-report';
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://nora.example/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: vi.fn() }));
const report: SiteReport = {
  schemaVersion: 1,
  registrySystemId: 'ghest',
  environment: 'PRODUCTION',
  checkedAt: '2026-11-02T12:00:00Z',
  from: '2026-11-01',
  to: '2026-11-02',
  metrics: {
    sales: { value: 1, state: 'AVAILABLE' },
    orders: { value: 0, state: 'AVAILABLE' },
  },
  totals: {},
  salesByCurrency: [
    { currency: 'IRT', amount: '9007199254740993', complete: true },
  ],
  trends: { orders: [{ date: '2026-11-02', value: 2 }] },
  visits: {
    pageViews: 0,
    uniqueBrowsers: 0,
    daily: [],
    definition: 'anonymous',
    available: false,
  },
  activity: [],
  activityAvailable: true,
};
beforeEach(() => {
  vi.mocked(localizedFetch).mockReset();
  vi.mocked(localizedFetch).mockImplementation(
    async () =>
      new Response(JSON.stringify(report), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
});
describe('Independent first-page site reporting', () => {
  it('dispatches Ghestiroo report/details to its own authenticated API, preserving UUID cursors and queues', async () => {
    await integrationsApi.siteReport(
      'branch',
      report.from,
      report.to,
      undefined,
      'ghest',
      'ghestiroo',
    );
    await integrationsApi.siteReportDetails('branch', 'ghest', 'ghestiroo', {
      from: report.from,
      to: report.to,
      metric: 'pending',
      after: 'a'.repeat(32),
      queue: 'requests',
    });
    for (const [url, init] of vi.mocked(localizedFetch).mock.calls) {
      expect(String(url)).toContain(
        '/ghestiroo/dashboard?branchId=branch&systemId=ghest',
      );
      expect(init).toMatchObject({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      expect(String(url)).not.toContain('/niyayesh');
    }
    expect(
      JSON.parse(String(vi.mocked(localizedFetch).mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      after: 'a'.repeat(32),
      queue: 'requests',
      metric: 'pending',
    });
  });
  it('retains the Niyayesh producer and numeric paging for other sites', async () => {
    await integrationsApi.siteReport(
      'branch',
      report.from,
      report.to,
      undefined,
      'other',
      'niyayesh',
    );
    await integrationsApi.siteReportDetails('branch', 'other', 'niyayesh', {
      from: report.from,
      to: report.to,
      metric: 'users',
      after: 25,
    });
    expect(String(vi.mocked(localizedFetch).mock.calls[0]?.[0])).toContain(
      '/niyayesh/report?',
    );
    expect(String(vi.mocked(localizedFetch).mock.calls[1]?.[0])).toContain(
      'resource=customer-accounts&after=25',
    );
  });
  it('keeps exact money and refuses stale site/period responses', () => {
    expect(reportMetricText(report, 'sales')).toBe('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳ IRT');
    expect(reportMetricText(report, 'orders')).toBe('۰');
    expect(
      scopedSiteReport(
        { report, state: 'available' },
        'other',
        report.from,
        report.to,
      ),
    ).toBeNull();
    expect(
      scopedSiteReport(
        { report, state: 'available' },
        'ghest',
        '2026-10-01',
        report.to,
      ),
    ).toBeNull();
    expect(dailySeries(report, 'orders')).toEqual([
      { date: '2026-11-01', value: 0 },
      { date: '2026-11-02', value: 2 },
    ]);
  });
  it('distinguishes absent historic analytics from measured zero and discloses coverage start', () => {
    const absent = renderToStaticMarkup(
      <SiteVisits
        report={report}
        label="range"
        siteName="قسطی‌رو"
        loading={false}
      />,
    );
    expect(absent).toContain('ثبت بازدید این سایت هنوز فعال نشده است');
    expect(absent).not.toContain('<strong>۰</strong>');
    const measured = renderToStaticMarkup(
      <SiteVisits
        report={{
          ...report,
          visits: {
            ...report.visits,
            available: true,
            coverageFrom: '2026-11-02T12:00:00Z',
          },
        }}
        label="range"
        siteName="قسطی‌رو"
        loading={false}
      />,
    );
    expect(measured).toContain('<strong>۰</strong>');
    expect(measured).toContain('پیش از آن سابقه‌ای ثبت نشده است');
  });
  it('shows actual source activities and a true empty state', () => {
    expect(
      renderToStaticMarkup(
        <SiteActivity report={report} siteName="قسطی‌رو" loading={false} />,
      ),
    ).toContain('فعالیتی در این بازه ثبت نشده است');
    const actual = {
      ...report,
      activity: [
        {
          id: 'event-1',
          resource: 'customer-orders',
          operation: 'checkout.activated',
          externalId: 'case-1',
          occurredAt: '2026-11-02T12:00:00Z',
          origin: 'ghestiroo',
          version: 0,
        },
      ],
    };
    expect(
      renderToStaticMarkup(
        <SiteActivity report={actual} siteName="قسطی‌رو" loading={false} />,
      ),
    ).toContain('فعال‌سازی خرید');
  });
});
