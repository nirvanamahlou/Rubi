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

  it('delegates Master Data mutations to its persistent Audit feed', () => {
    const notification = buildChangeNotification(
      {
        method: 'POST',
        requestUrl: `${apiBaseUrl}/master-data/currencies/currency-1/deactivate`,
        responseOk: true,
      },
      apiBaseUrl,
      options,
    );
    expect(notification).toBeNull();
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
    'search',
    'without-outcome',
    'today-calls',
    'week-calls',
    'missed-callbacks',
    'report',
  ])('never notifies on repeated Call Center %s reads', async (endpoint) => {
    const response = new Response(JSON.stringify({ data: [] }));
    const originalFetch = vi.fn().mockResolvedValue(response);
    const onNotification = vi.fn();
    const trackedFetch = createTrackedFetch(
      originalFetch as unknown as typeof fetch,
      apiBaseUrl,
      onNotification,
      () => 'read-notification',
      () => new Date(options.occurredAt),
    );
    for (const suffix of ['', '/?page=1', '?page=2']) {
      const request = new Request(
        `${apiBaseUrl}/customer-affairs/call-center/${endpoint}${suffix}`,
        { method: 'POST', body: JSON.stringify({ page: 1 }) },
      );
      await expect(trackedFetch(request)).resolves.toBe(response);
      expect(originalFetch).toHaveBeenLastCalledWith(request);
    }
    expect(originalFetch).toHaveBeenCalledTimes(3);
    expect(onNotification).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', 'calls'],
    ['PATCH', 'calls/call-1'],
    ['POST', 'contacts/contact-1/notes'],
    ['POST', 'contacts/contact-1/requests'],
    ['POST', 'report-settings'],
  ])('preserves genuine Call Center %s %s notifications', (method, path) => {
    expect(
      buildChangeNotification(
        {
          method,
          requestUrl: `${apiBaseUrl}/customer-affairs/call-center/${path}`,
          responseOk: true,
        },
        apiBaseUrl,
        options,
      ),
    ).toMatchObject({
      href: '/customer-affairs/call-center',
      title: expect.stringContaining('کال سنتر'),
      readAt: null,
    });
  });

  it.each(['leads', 'tickets'])(
    'keeps non-Call-Center Customer Affairs %s notifications in their own workspace',
    (path) => {
      expect(
        buildChangeNotification(
          {
            method: 'POST',
            requestUrl: `${apiBaseUrl}/customer-affairs/${path}`,
            responseOk: true,
          },
          apiBaseUrl,
          options,
        ),
      ).toMatchObject({
        href: '/customer-affairs',
        title: 'ثبت اطلاعات جدید در امور مشتریان',
        readAt: null,
      });
    },
  );

  it('does not suppress real mutations with a similar technical path name', () => {
    expect(
      buildChangeNotification(
        {
          method: 'POST',
          requestUrl: `${apiBaseUrl}/customer-affairs/call-center/telephony/lease-settings`,
          responseOk: true,
        },
        apiBaseUrl,
        options,
      ),
    ).toMatchObject({ href: '/customer-affairs/call-center', readAt: null });
  });

  it.each([
    ['GET', `${apiBaseUrl}/customers`, true],
    ['PATCH', `${apiBaseUrl}/customers/customer-1`, false],
    ['POST', `${apiBaseUrl}/iam/auth/refresh`, true],
    ['POST', `${apiBaseUrl}/iam/auth/change-password`, true],
    ['POST', `${apiBaseUrl}/iam/auth/mfa/confirm`, true],
    ['DELETE', `${apiBaseUrl}/iam/auth/sessions/session-1`, true],
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

it('never recreates generic alerts for recurring telephony lease acquire, renew or release', async () => {
  const response = new Response(JSON.stringify({ leader: true }));
  const original = vi.fn().mockResolvedValue(response);
  const notify = vi.fn();
  const tracked = createTrackedFetch(
    original,
    apiBaseUrl,
    notify,
    () => crypto.randomUUID(),
    () => new Date(),
  );
  for (const release of [false, false, true]) {
    await expect(
      tracked(
        `${apiBaseUrl}/customer-affairs/call-center/telephony/lease/?branchId=synthetic`,
        {
          method: 'POST',
          body: JSON.stringify({ tabId: 'test', release }),
        },
      ),
    ).resolves.toBe(response);
  }
  expect(notify).not.toHaveBeenCalled();
  // A genuine call workflow command must still notify normally.
  await tracked(
    `${apiBaseUrl}/customer-affairs/call-center/contacts/contact/requests`,
    { method: 'POST' },
  );
  expect(notify).toHaveBeenCalledOnce();
});
