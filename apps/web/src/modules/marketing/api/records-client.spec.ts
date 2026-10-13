import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyNotificationFeedChanged } from '@/modules/notifications/api/client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://api.example.test',
}));
vi.mock('@/modules/notifications/api/client', () => ({
  notifyNotificationFeedChanged: vi.fn(),
}));

import { marketingApi } from './records-client';

function campaign(id: string, version: number, status: 'DRAFT' | 'ACTIVE') {
  return {
    contractVersion: 'marketing.records.v1',
    id,
    branchId: 'branch-1',
    internalCode: 'TEST',
    name: 'داده سرور',
    campaignType: 'SALE',
    objective: 'Test',
    executionCompany: 'NIAYESH_SEIR_SAHAR',
    channels: ['SMS'],
    ownerUserId: 'actor',
    segmentId: null,
    salesTarget: '10',
    targetCurrencyCode: 'IRR',
    budgetAmount: '12',
    budgetCurrencyCode: 'IRR',
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: '2026-11-01T00:00:00.000Z',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    frequencyCap: 1,
    progressPercent: '0',
    spendLines: [],
    links: [],
    status,
    publicationRequestedAt: null,
    scheduledFor: null,
    version,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    declaredByUserId: 'actor',
    declaredAt: '2026-10-01T00:00:00.000Z',
    externalPublicationStatus: 'UNAVAILABLE',
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('marketing durable API client', () => {
  it('keeps failed saves as typed server errors without returning fixture data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'CONCURRENT_MODIFICATION',
          message: 'نسخه تغییر کرده است.',
        }),
        {
          status: 409,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      marketingApi.saveAsset(
        {
          kind: 'SEGMENT',
          name: 'سگمنت',
          status: 'ACTIVE',
          payload: { rules: [] },
        },
        { branchId: 'branch-1', key: 'stable-key' },
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: 'CONCURRENT_MODIFICATION',
      message: 'نسخه تغییر کرده است.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(notifyNotificationFeedChanged).not.toHaveBeenCalled();
  });

  it('reloads campaign data from the server and sends caller idempotency keys', async () => {
    const row = campaign('campaign-server', 4, 'DRAFT');
    const published = campaign('campaign-server', 5, 'ACTIVE');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [row] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: published }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(marketingApi.campaigns()).resolves.toEqual({
      data: [row],
    });
    await marketingApi.publishCampaign(
      'campaign-server',
      4,
      null,
      'publish-key',
    );

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'idempotency-key': 'publish-key' });
    expect(init.body).toBe(
      JSON.stringify({ expectedVersion: 4, scheduledFor: null }),
    );
    expect(notifyNotificationFeedChanged).toHaveBeenCalledOnce();
  });

  it('rejects a successful campaign response for a different entity without notifying', async () => {
    vi.mocked(notifyNotificationFeedChanged).mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: campaign('another-campaign', 5, 'ACTIVE'),
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(
      marketingApi.publishCampaign('campaign-server', 4, null, 'publish-key'),
    ).rejects.toMatchObject({
      status: 200,
      code: 'CAMPAIGN_MUTATION_RESPONSE_MISMATCH',
    });
    expect(notifyNotificationFeedChanged).not.toHaveBeenCalled();
  });
});
