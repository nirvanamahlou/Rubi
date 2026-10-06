import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyNotificationFeedChanged } from '@/modules/notifications/api/client';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://api.example.test',
}));
vi.mock('@/modules/notifications/api/client', () => ({
  notifyNotificationFeedChanged: vi.fn(),
}));

import { marketingApi } from './records-client';

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
    const campaign = { id: 'campaign-server', name: 'داده سرور', version: 4 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [campaign] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: campaign }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(marketingApi.campaigns()).resolves.toEqual({
      data: [campaign],
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
});
