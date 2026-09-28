import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DocumentsRepository } from './documents.repository';

describe('DocumentsRepository source scoping', () => {
  it('matches message uploads against the MESSAGING source module', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new DocumentsRepository(
      { client: { document: { findMany } } } as unknown as DatabaseService,
      {} as NotificationsService,
    );
    await repository.workbenchOwnedAttachmentIds({
      documentIds: ['44444444-4444-4444-8444-444444444444'],
      sourceModule: 'MESSAGING',
      sourceEntityType: 'MessagingMessage',
      sourceEntityId: 'message:request-0001',
      branchId: '33333333-3333-4333-8333-333333333333',
      ownerUserId: '11111111-1111-4111-8111-111111111111',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceModule: 'MESSAGING',
          sourceEntityType: 'MessagingMessage',
          sourceEntityId: 'message:request-0001',
        }),
      }),
    );
  });

  it('checks the stored confidentiality of a feedback attachment', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new DocumentsRepository(
      { client: { document: { findMany } } } as unknown as DatabaseService,
      {} as NotificationsService,
    );
    await repository.workbenchOwnedAttachmentIds({
      documentIds: ['44444444-4444-4444-8444-444444444444'],
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchFeedback',
      sourceEntityId: '55555555-5555-4555-8555-555555555555',
      branchId: '33333333-3333-4333-8333-333333333333',
      ownerUserId: '11111111-1111-4111-8111-111111111111',
      confidentiality: 'RESTRICTED',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ confidentiality: 'RESTRICTED' }),
      }),
    );
  });

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
        NOT: {
          sourceModule: 'WORKBENCH',
          sourceEntityType: 'WorkbenchFeedback',
          ownerUserId: { not: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' },
        },
      }),
    });
    expect(findMany).toHaveBeenCalledOnce();
  });

  it('does not expose sensitive metadata through filtered result counts', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new DocumentsRepository(
      {
        client: {
          document: { count, findMany },
          $transaction: async (operations: Promise<unknown>[]) =>
            Promise.all(operations),
        },
      } as unknown as DatabaseService,
      {} as NotificationsService,
    );
    const query = {
      search: 'private-name.pdf',
      ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      page: 1,
      pageSize: 25,
      sortBy: 'updatedAt' as const,
      sortDirection: 'desc' as const,
    };

    await repository.list(query, ['branch-a'], ['GENERAL'], 'reader-a', false);
    expect(count.mock.calls[0]?.[0].where.confidentiality).toEqual({
      notIn: ['CONFIDENTIAL', 'RESTRICTED'],
    });

    await repository.list(query, ['branch-a'], ['GENERAL'], 'reader-a', true);
    expect(count.mock.calls[1]?.[0].where.confidentiality).toBeUndefined();

    const denied = await repository.list(
      { ...query, confidentiality: 'RESTRICTED' },
      ['branch-a'],
      ['GENERAL'],
      'reader-a',
      false,
    );
    expect(denied).toEqual({ rows: [], total: 0 });
    expect(count).toHaveBeenCalledTimes(2);
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
