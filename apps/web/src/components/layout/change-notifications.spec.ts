import { describe, expect, it, vi } from 'vitest';

import {
  buildChangeNotification,
  CHANGE_NOTIFICATIONS_LIMIT,
  limitChangeNotifications,
  parseChangeNotifications,
  createTrackedFetch,
  type ChangeNotification,
} from './change-notifications';

const apiBaseUrl = 'http://localhost:4000/api/v1';
const options = { id: 'notification-1', occurredAt: '2026-09-07T08:00:00Z' };

describe('global change notifications', () => {
  it('turns successful API mutations into safe section notifications', () => {
    expect(
      buildChangeNotification(
        {
          method: 'PATCH',
          requestUrl: `${apiBaseUrl}/customers/customer-1`,
          responseOk: true,
        },
        apiBaseUrl,
        options,
      ),
    ).toEqual({
      id: 'notification-1',
      title: 'ویرایش در مشتریان',
      description: 'ویرایش با موفقیت ثبت شد.',
      href: '/customers',
      occurredAt: '2026-09-07T08:00:00Z',
      readAt: null,
    });
  });

  it('labels status operations and routes each module to its owning section', () => {
    const notification = buildChangeNotification(
      {
        method: 'POST',
        requestUrl: `${apiBaseUrl}/master-data/currencies/currency-1/deactivate`,
        responseOk: true,
      },
      apiBaseUrl,
      options,
    );
    expect(notification?.title).toBe('غیرفعال‌سازی در اطلاعات پایه');
    expect(notification?.href).toBe('/master-data');
  });

  it('records a successful mutation after fetch without changing its response', async () => {
    const response = new Response(null, { status: 204 });
    const originalFetch = vi.fn().mockResolvedValue(response);
    const onNotification = vi.fn();
    const trackedFetch = createTrackedFetch(
      originalFetch as unknown as typeof fetch,
      apiBaseUrl,
      onNotification,
      () => 'notification-1',
      () => new Date('2026-09-07T08:00:00Z'),
    );

    await expect(
      trackedFetch(`${apiBaseUrl}/customers/customer-1`, {
        method: 'PATCH',
      }),
    ).resolves.toBe(response);
    expect(onNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'ویرایش در مشتریان',
        href: '/customers',
      }),
    );
  });

  it.each([
    ['GET', `${apiBaseUrl}/customers`, true],
    ['PATCH', `${apiBaseUrl}/customers/customer-1`, false],
    ['POST', `${apiBaseUrl}/iam/auth/refresh`, true],
    ['POST', `${apiBaseUrl}/master-data/imports/preview`, true],
    ['POST', `${apiBaseUrl}/master-data/exports/xlsx`, true],
    ['POST', `${apiBaseUrl}/documents/document-1/archive`, true],
    ['PATCH', `${apiBaseUrl}/notifications/read-all`, true],
    ['PATCH', `${apiBaseUrl}/hr/records/record-1`, true],
    ['POST', `${apiBaseUrl}/hr/notifications/notice-1/read`, true],
    ['POST', 'https://other.example/api/v1/customers', true],
  ])('ignores non-change request %s %s', (method, requestUrl, responseOk) => {
    expect(
      buildChangeNotification(
        { method, requestUrl, responseOk },
        apiBaseUrl,
        options,
      ),
    ).toBeNull();
  });

  it('rejects malformed storage and keeps only the newest safe entries', () => {
    expect(parseChangeNotifications('{broken')).toEqual([]);
    expect(
      parseChangeNotifications(
        JSON.stringify([{ ...options, href: 'https://unsafe.example' }]),
      ),
    ).toEqual([]);

    const records: ChangeNotification[] = Array.from(
      { length: CHANGE_NOTIFICATIONS_LIMIT + 5 },
      (_, index) => ({
        id: `notification-${index}`,
        title: 'تغییر',
        description: 'ثبت شد.',
        href: '/dashboard',
        occurredAt: new Date(Date.UTC(2026, 8, 7, 8, index)).toISOString(),
        readAt: null,
      }),
    );
    const limited = limitChangeNotifications(records);
    expect(limited).toHaveLength(CHANGE_NOTIFICATIONS_LIMIT);
    expect(limited[0]?.id).toBe('notification-64');
  });
});
