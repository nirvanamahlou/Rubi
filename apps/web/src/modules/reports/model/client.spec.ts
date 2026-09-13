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

  it('keeps every travel output measure when normalizing it for the preview table', async () => {
    const payload = {
      reportCode: 'sales_by_service_route',
      reportVersion: 1,
      grain: 'SERVICE_ROUTE_CURRENCY',
      sourceProjection: 'travel.reporting.service-route.v1',
      rows: [
        {
          grainId: 'tour:tehran-shiraz:IRR',
          primaryDimension: 'تور',
          secondaryDimension: 'تهران ← شیراز',
          currencyCode: 'IRR',
          orderCount: 2,
          passengerCount: 5,
          ticketCount: 3,
          salesAmount: '1250000',
          purchaseAmount: '900000',
          grossProfit: '350000',
          refundAmount: '50000',
          settlementBalance: '125000',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      previewLimit: 100,
      generatedAtUtc: '2026-09-13T10:00:00.000Z',
      sourceDataAsOfUtc: '2026-09-13T09:55:00.000Z',
      totalsByCurrency: [{ currencyCode: 'IRR', salesAmount: '1250000' }],
      filterSnapshot: { capturedAtUtc: '2026-09-13T10:00:00.000Z', branchIds: [], filters: {} },
      filterOptions: {},
      warnings: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))),
    );

    const result = await reportingApi.salesByOrganization({
      reportCode: 'sales_by_service_route',
    });

    expect(result.rows[0]).toMatchObject({
      contractCount: 2,
      passengerCount: 5,
      ticketCount: 3,
      amount: '1250000',
      purchaseAmount: '900000',
      grossProfit: '350000',
      refundAmount: '50000',
      settlementBalance: '125000',
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
