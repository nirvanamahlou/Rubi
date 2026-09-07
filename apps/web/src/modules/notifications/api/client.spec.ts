import { afterEach, describe, expect, it, vi } from 'vitest';

import { notificationsApi } from './client';

const originalBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

describe('notifications API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined)
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalBaseUrl;
  });

  it('loads only the authenticated notification feed and marks records read', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api/v1';
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ data: [], meta: { unreadCount: 0, limit: 20 } }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await notificationsApi.list();
    await notificationsApi.markRead('notification/id');
    await notificationsApi.markAllRead();
    await notificationsApi.clearRead();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:4000/api/v1/notifications?limit=20',
      'http://localhost:4000/api/v1/notifications/notification%2Fid/read',
      'http://localhost:4000/api/v1/notifications/read-all',
      'http://localhost:4000/api/v1/notifications/read',
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual([
      undefined,
      'PATCH',
      'PATCH',
      'DELETE',
    ]);
  });
});
