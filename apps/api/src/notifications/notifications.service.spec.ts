import { describe, expect, it, vi } from 'vitest';

import type { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  it('deduplicates recipients when writing inside the caller transaction', async () => {
    const service = new NotificationsService({} as NotificationsRepository);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });

    await service.createWithinTransaction(
      { notification: { createMany } } as never,
      {
        recipientUserIds: ['user-a', 'user-a'],
        actorUserId: 'user-a',
        sourceModule: 'documents',
        eventType: 'documents.upload',
        title: 'سند جدید بارگذاری شد',
        message: 'سند «نمونه» بارگذاری شد.',
        entityType: 'Document',
        entityId: 'document-a',
        href: '/documents?document=document-a',
      },
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          recipientUserId: 'user-a',
          eventType: 'documents.upload',
        }),
      ],
    });
  });
});
