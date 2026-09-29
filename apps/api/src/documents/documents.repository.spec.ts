import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DocumentsRepository } from './documents.repository';

describe('DocumentsRepository source scoping', () => {
  it('combines exact primary-case source filtering with branch and domain scope', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const database = {
      client: {
        document: { count, findMany },
        $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
          Promise.all(operations),
        ),
      },
    } as unknown as DatabaseService;
    const repository = new DocumentsRepository(database, {
      createWithinTransaction: vi.fn(),
    } as unknown as NotificationsService);

    await repository.list(
      {
        branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        domain: 'CUSTOMER_IDENTITY',
        sourceModule: 'customers',
        sourceEntityType: 'Customer',
        sourceEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
      },
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      ['CUSTOMER_IDENTITY'],
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    );

    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        branchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        documentType: expect.objectContaining({
          domain: { in: ['CUSTOMER_IDENTITY'] },
        }),
        relations: {
          some: {
            relationType: 'PRIMARY_CASE',
            sourceModule: 'customers',
            sourceEntityType: 'Customer',
            sourceEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          },
        },
      }),
    });
    expect(findMany).toHaveBeenCalledOnce();
  });

  it('writes the metadata-change notification in the same transaction', async () => {
    const transaction = {
      document: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'document-a' }),
      },
      documentAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const database = {
      client: {
        $transaction: vi.fn(
          async (callback: (value: typeof transaction) => Promise<unknown>) =>
            callback(transaction),
        ),
      },
    } as unknown as DatabaseService;
    const createWithinTransaction = vi.fn().mockResolvedValue(undefined);
    const repository = new DocumentsRepository(database, {
      createWithinTransaction,
    } as unknown as NotificationsService);

    await repository.updateMetadata({
      documentId: 'document-a',
      expectedVersion: 1,
      title: 'قرارداد ویرایش‌شده',
      description: null,
      categoryId: 'category-a',
      ownerUserId: 'owner-a',
      confidentiality: 'INTERNAL',
      validUntil: null,
      isIncomplete: false,
      actorUserId: 'actor-a',
      actorBranchId: 'branch-a',
      ipSummary: '192.0.2.1',
      userAgentSummary: 'test',
    });

    expect(createWithinTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        recipientUserIds: ['actor-a', 'owner-a'],
        eventType: 'documents.metadata.update',
        entityId: 'document-a',
      }),
    );
  });
});
