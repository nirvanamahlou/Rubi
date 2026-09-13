import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportDateRangeUtc, reportingApi } from './client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:4000/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn().mockResolvedValue(null),
}));

afterEach(() => vi.unstubAllGlobals());

describe('reporting public projection client', () => {
  it('queries the authenticated Reporting endpoint without bypassing its grain policy', async () => {
    const payload = {
      reportCode: 'sales_by_organization',
      sourceProjection: 'sales.reporting.organization.v2',
      rows: [],
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetch);

    await expect(
      reportingApi.salesByOrganization({
        currencyCode: 'IRR',
        fromDate: '2026-09-01',
        sort: { column: 'contractCount', direction: 'ASC' },
        toDate: '2026-09-10',
      }),
    ).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/reports/sales_by_organization/preview',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        body: expect.stringContaining('"currencyCode":"IRR"'),
      }),
    );
    expect(fetch.mock.calls[0]?.[1]?.body).toContain(
      '"fromUtc":"2026-08-31T20:30:00.000Z"',
    );
    expect(fetch.mock.calls[0]?.[1]?.body).toContain(
      '"toUtc":"2026-09-10T20:30:00.000Z"',
    );
    expect(fetch.mock.calls[0]?.[1]?.body).toContain(
      '"sort":{"column":"contractCount","direction":"ASC"}',
    );
  });

  it('converts the inclusive Tehran calendar range to half-open UTC bounds', () => {
    expect(reportDateRangeUtc('2026-09-01', '2026-09-10')).toEqual({
      fromUtc: '2026-08-31T20:30:00.000Z',
      toUtc: '2026-09-10T20:30:00.000Z',
    });
  });

  it('does not replace a network failure with zero-valued report data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(reportingApi.salesByOrganization()).rejects.toMatchObject({
      status: 0,
    });
  });

  it('loads live operational navigation counts without browser caching', async () => {
    const payload = {
      myReports: 2,
      sharedWithMe: 1,
      runs: 5,
      schedules: 3,
      exports: 4,
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetch);

    await expect(reportingApi.workspaceCounts()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/reports/workspace-counts',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });
});
