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
  it('uses the recording endpoint only for the explicit result action', async () => {
    const fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            reportCode: 'sales_by_organization',
            sourceProjection: 'sales.reporting.organization.v2',
            rows: [],
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetch);

    await reportingApi.salesByOrganization({ recordAction: true });
    await reportingApi.salesByOrganization({ page: 2 });
    expect(fetch.mock.calls[0]?.[0]).toBe(
      'http://localhost:4000/api/v1/reports/sales_by_organization/preview-run',
    );
    expect(fetch.mock.calls[1]?.[0]).toBe(
      'http://localhost:4000/api/v1/reports/sales_by_organization/preview',
    );
  });

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
      '"sort":{"column":"orderCount","direction":"ASC"}',
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
      filterSnapshot: {
        capturedAtUtc: '2026-09-13T10:00:00.000Z',
        branchIds: [],
        filters: {},
      },
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

  it('maps every detailed table sort column to the approved travel projection', async () => {
    const payload = {
      reportCode: 'sales_by_service_route',
      reportVersion: 1,
      grain: 'ORDER_ITEM_CURRENCY',
      sourceProjection: 'reporting.travel.facts.v1',
      columns: [],
      rows: [],
      total: 0,
      page: 1,
      pageSize: 25,
      previewLimit: 100,
      generatedAtUtc: '2026-09-14T10:00:00.000Z',
      sourceDataAsOfUtc: null,
      totalsByCurrency: [],
      filterSnapshot: {
        capturedAtUtc: '2026-09-14T10:00:00.000Z',
        branchIds: [],
        filters: {},
      },
      filterOptions: {},
      warnings: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetchMock);

    await reportingApi.salesByOrganization({
      reportCode: 'sales_by_service_route',
      sort: { column: 'grossProfit', direction: 'ASC' },
    });

    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain(
      '"sort":{"column":"grossProfit","direction":"ASC"}',
    );
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

  it('loads eligible recipients and persists explicit report shares', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: 'user-2', displayName: 'کاربر دوم', username: 'user.two' },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            savedReportId: 'report-1',
            recipientUserIds: ['user-2'],
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);

    await expect(
      reportingApi.sharingRecipients('sales_by_service_route'),
    ).resolves.toHaveLength(1);
    await reportingApi.shareSavedReport('report-1', ['user-2']);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:4000/api/v1/reports/sales_by_service_route/share-recipients',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4000/api/v1/reports/saved/report-1/shares',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recipientUserIds: ['user-2'] }),
      }),
    );
  });
});
