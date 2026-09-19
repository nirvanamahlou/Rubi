import { describe, expect, it } from 'vitest';

import { NOTIFICATIONS_CONTRACT_VERSION } from './index';
import type { NotificationListResponseV1 } from './index';

describe('notifications shared contract v1', () => {
  it('keeps recipient-scoped unread metadata and safe navigation data', () => {
    const response: NotificationListResponseV1 = {
      data: [
        {
          id: 'notification-1',
          sourceModule: 'documents',
          eventType: 'documents.upload',
          title: 'سند بارگذاری شد',
          message: 'سند «قرارداد نمونه» بارگذاری شد.',
          entityType: 'Document',
          entityId: 'document-1',
          href: '/documents?document=document-1',
          isRead: false,
          occurredAt: '2026-09-07T12:00:00.000Z',
          actor: { id: 'user-1', displayName: 'کاربر نمونه' },
        },
      ],
      meta: { unreadCount: 1, limit: 20 },
    };

    expect(NOTIFICATIONS_CONTRACT_VERSION).toBe(1);
    expect(response.meta.unreadCount).toBe(1);
    expect(response.data[0]?.href).toContain('/documents?document=');
  });
});
