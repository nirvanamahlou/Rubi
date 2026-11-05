import fs from 'node:fs';
import path from 'node:path';

import type { MasterDataNotification } from '@/modules/master-data/api/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChangeNotification } from './change-notifications';
import {
  notificationScope,
  mergeMasterDataFeed,
  notificationStorage,
} from './notification-center';

describe('NotificationCenter integration contract', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, 'notification-center.tsx'),
    'utf8',
  );

  it('combines persistent server notifications with browser-local changes', () => {
    expect(source).toContain('notificationsApi.list()');
    expect(source).toContain('.map(serverNotification)');
    expect(source).toContain('.map(localNotification)');
    expect(source).toContain('NOTIFICATIONS_CHANGED_EVENT');
  });

  it('supports recipient-scoped read and clear actions through the API', () => {
    expect(source).toMatch(/notificationsApi\s*\.markRead\(notification\.id\)/);
    expect(source).toContain('notificationsApi.markAllRead()');
    expect(source).toContain('notificationsApi.clearRead()');
  });

  it('renders loading, empty, retry and unread states in Persian', () => {
    expect(source).toContain('در حال دریافت اعلان‌ها');
    expect(source).toContain('اعلانی ندارید');
    expect(source).toContain('تلاش دوباره');
    expect(source).toContain('خوانده‌نشده');
  });
});

const auditEvent: MasterDataNotification = {
  id: 'audit-1',
  action: 'master_data.update',
  changeKind: 'updated',
  resource: 'hotels',
  entityId: 'hotel-1',
  entityVersion: 2,
  recordLabel: 'هتل اسپیناس پالاس',
  occurredAt: '2026-09-07T08:00:00.000Z',
};

describe('NotificationCenter Master Data feed', () => {
  it('does not recreate cleared audit notifications after a poll or browser reload', () => {
    const storedDismissals = JSON.stringify(['master-data:audit-1']);
    const dismissed = new Set<string>(JSON.parse(storedDismissals));
    expect(mergeMasterDataFeed([], [auditEvent], dismissed)).toEqual([]);
    const stale = mergeMasterDataFeed([], [auditEvent]);
    expect(mergeMasterDataFeed(stale, [auditEvent], dismissed)).toEqual([]);
  });

  it('continues to show new changes to the same record after older notifications are cleared', () => {
    const nextEvent = { ...auditEvent, id: 'audit-2', entityVersion: 3 };
    expect(
      mergeMasterDataFeed(
        [],
        [auditEvent, nextEvent],
        new Set(['master-data:audit-1']),
      ),
    ).toEqual([
      expect.objectContaining({ id: 'master-data:audit-2', readAt: null }),
    ]);
  });
  it('adds a backend Audit event with its owning section link', () => {
    expect(mergeMasterDataFeed([], [auditEvent])).toEqual([
      {
        id: 'master-data:audit-1',
        title: 'هتل «هتل اسپیناس پالاس» ویرایش شد',
        description: 'تغییر در هتل‌ها ثبت شد.',
        href: '/master-data/accommodation?resource=hotels',
        occurredAt: auditEvent.occurredAt,
        readAt: null,
      },
    ]);
  });

  it('does not duplicate a polled event and preserves its read state', () => {
    const existing: ChangeNotification = {
      id: 'master-data:audit-1',
      title: 'عنوان قدیمی',
      description: 'توضیح قدیمی',
      href: '/master-data',
      occurredAt: auditEvent.occurredAt,
      readAt: '2026-09-07T08:05:00.000Z',
    };

    const merged = mergeMasterDataFeed([existing], [auditEvent]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: existing.id,
      readAt: existing.readAt,
      href: '/master-data/accommodation?resource=hotels',
    });
  });
});

it('isolates browser cache across users, branches and permission changes', () => {
  const actor = {
    userId: 'a',
    branchIds: ['b'],
    permissions: ['documents.read'],
  } as never;
  expect(notificationScope(actor)).not.toBe(
    notificationScope({ ...(actor as object), userId: 'other' } as never),
  );
  expect(notificationScope(actor)).not.toBe(
    notificationScope({
      userId: 'a',
      branchIds: ['c'],
      permissions: ['documents.read'],
    } as never),
  );
  expect(notificationScope(actor)).not.toBe(
    notificationScope({
      userId: 'a',
      branchIds: ['b'],
      permissions: [],
    } as never),
  );
});

describe('retained audit acknowledgements', () => {
  afterEach(() => vi.unstubAllGlobals());
  function browser() {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });
    return values;
  }
  it('retains read state after list eviction, reload and a permission/branch switch', () => {
    browser();
    const stored = notificationStorage('user-a:old-scope', 'audit:user-a');
    const read = mergeMasterDataFeed([], [auditEvent]).map((item) => ({
      ...item,
      readAt: '2026-11-04T08:00:00Z',
    }));
    stored.writeStoredNotifications(read);
    stored.writeStoredNotifications(
      Array.from({ length: 60 }, (_, i) => ({
        id: `local-${i}`,
        title: 'change',
        description: 'change',
        href: '/workbench',
        occurredAt: '2026-11-04T09:00:00Z',
        readAt: null,
      })),
    );
    expect(
      stored.readStoredNotifications().some((item) => item.id === read[0]!.id),
    ).toBe(false);
    const reloaded = notificationStorage('user-a:new-scope', 'audit:user-a');
    const feed = mergeMasterDataFeed(
      [],
      [auditEvent, { ...auditEvent, id: 'truly-new' }],
      reloaded.readDismissedAuditIds(),
      reloaded.readAuditReadTimes(),
    );
    expect(feed.find((item) => item.id === read[0]!.id)?.readAt).toBe(
      read[0]!.readAt,
    );
    expect(
      feed.find((item) => item.id === 'master-data:truly-new')?.readAt,
    ).toBeNull();
    expect(
      notificationStorage('user-b', 'audit:user-b').readAuditReadTimes().size,
    ).toBe(0);
  });
  it('clears evicted acknowledged events without hiding unread events after reload', () => {
    browser();
    const stored = notificationStorage('user-a:old-scope', 'audit:user-a');
    const [acknowledged] = mergeMasterDataFeed([], [auditEvent]);
    stored.writeStoredNotifications([
      { ...acknowledged!, readAt: '2026-11-04T08:00:00Z' },
    ]);
    const unread = Array.from({ length: 60 }, (_, i) => ({
      id: `local-${i}`,
      title: 'change',
      description: 'change',
      href: '/workbench',
      occurredAt: '2026-11-04T09:00:00Z',
      readAt: null,
    }));
    stored.writeStoredNotifications(unread);
    expect(stored.readStoredNotifications()).not.toContainEqual(
      expect.objectContaining({ id: acknowledged!.id }),
    );
    expect(stored.clearReadNotifications()).toEqual(unread);
    const reloaded = notificationStorage('user-a:new-scope', 'audit:user-a');
    expect(
      mergeMasterDataFeed(
        [],
        [auditEvent, { ...auditEvent, id: 'unread' }],
        reloaded.readDismissedAuditIds(),
        reloaded.readAuditReadTimes(),
      ),
    ).toEqual([
      expect.objectContaining({ id: 'master-data:unread', readAt: null }),
    ]);
  });
  it('migrates old scoped dismissals so clearing remains effective after scope changes', () => {
    const values = browser();
    values.set(
      'old-scope.dismissed-audit',
      JSON.stringify(['master-data:audit-1']),
    );
    const stored = notificationStorage('old-scope', 'audit:user-a');
    stored.writeStoredNotifications([]);
    const reloaded = notificationStorage('new-scope', 'audit:user-a');
    expect(
      mergeMasterDataFeed([], [auditEvent], reloaded.readDismissedAuditIds()),
    ).toEqual([]);
  });
});
