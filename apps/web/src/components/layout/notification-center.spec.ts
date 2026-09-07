import type { MasterDataNotification } from '@/modules/master-data/api/client';
import { describe, expect, it } from 'vitest';

import type { ChangeNotification } from './change-notifications';
import { mergeMasterDataFeed } from './notification-center';

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
