import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DocumentsRepository } from './documents.repository';

describe('DocumentsRepository source scoping', () => {
  it.each([true, false])(
    'creates scan jobs only for nonexempt uploads (logo=%s)',
    async (exempt) => {
      const create = () => ({ create: vi.fn().mockResolvedValue({}) });
      const transaction = {
        document: {
          ...create(),
          update: vi.fn(),
          findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'doc' }),
        },
        documentVersion: create(),
        documentRelation: create(),
        documentQuarantine: create(),
        documentProcessingJob: create(),
        documentAuditEvent: create(),
      };
      const repository = new DocumentsRepository(
        {
          client: {
            $transaction: (callback: (value: unknown) => unknown) =>
              callback(transaction),
          },
        } as unknown as DatabaseService,
        {
          createWithinTransaction: vi.fn().mockResolvedValue(undefined),
        } as unknown as NotificationsService,
      );
      await repository.createUploaded({
        documentId: 'doc',
        versionId: 'version',
        storageObjectKey: 'private/key',
        title: 'logo',
        description: null,
        documentTypeId: 'type',
        categoryId: 'category',
        branchId: 'branch',
        ownerUserId: 'actor',
        sourceModule: 'master-data',
        sourceEntityType: 'hotels',
        sourceEntityId: 'hotel',
        sourceDisplayLabel: 'Hotel',
        confidentiality: 'INTERNAL',
        requiresStepUpVerification: false,
        confidentialAccessCodeHash: null,
        confidentialAccessCodeSalt: null,
        validUntil: null,
        originalFileName: 'logo.png',
        safeDownloadName: 'logo.png',
        detectedMimeType: 'image/png',
        extension: 'png',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        versionNote: 'logo',
        actorUserId: 'actor',
        actorBranchId: 'branch',
        ipSummary: '',
        userAgentSummary: '',
        ...(exempt ? { skipAntivirusForMasterDataLogo: true } : {}),
      });
      expect(transaction.documentProcessingJob.create).toHaveBeenCalledTimes(
        exempt ? 0 : 1,
      );
      expect(transaction.documentQuarantine.create).toHaveBeenCalledTimes(
        exempt ? 0 : 1,
      );
      expect(transaction.documentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scanStatus: 'AWAITING_ANTIVIRUS_ADAPTER',
          }),
        }),
      );
      expect(transaction.documentAuditEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: exempt
              ? 'MASTER_DATA_LOGO_ANTIVIRUS_EXEMPT'
              : 'UPLOAD_ACCEPTED_TO_QUARANTINE',
          }),
        }),
      );
    },
  );
  it.each([true, false])(
    'initializes only missing fixed brand references when selected membership is %s',
    async (allowed) => {
      const types = vi.fn().mockResolvedValue({ count: 1 });
      const categories = vi.fn().mockResolvedValue({ count: 1 });
      const user = vi.fn().mockResolvedValue(allowed ? { id: 'user' } : null);
      const transaction = {
        user: { findFirst: user },
        branch: { findFirst: vi.fn().mockResolvedValue({ id: 'branch' }) },
        documentType: { createMany: types },
        documentCategory: { createMany: categories },
      };
      const repository = new DocumentsRepository(
        {
          client: {
            $transaction: (callback: (value: unknown) => unknown) =>
              callback(transaction),
          },
        } as unknown as DatabaseService,
        {} as NotificationsService,
      );
      expect(
        await repository.ensureMasterDataLogoReferences('user', 'branch'),
      ).toBe(allowed);
      expect(user).toHaveBeenCalledWith({
        where: {
          id: 'user',
          status: 'ACTIVE',
          branches: { some: { branchId: 'branch' } },
        },
        select: { id: true },
      });
      if (!allowed) {
        expect(types).not.toHaveBeenCalled();
        expect(categories).not.toHaveBeenCalled();
        return;
      }
      expect(types).toHaveBeenCalledWith({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            code: 'BRAND_ASSET_TEMPLATE',
            domain: 'BRAND',
            defaultConfidentiality: 'INTERNAL',
            maxFileSizeBytes: 26214400n,
            requiresExpiry: false,
          }),
        ],
      });
      expect(categories).toHaveBeenCalledWith({
        skipDuplicates: true,
        data: [{ code: 'BRAND_ASSETS', name: 'دارایی‌های برند' }],
      });
      // No update/upsert methods exist in this fixture: existing policies cannot be overwritten.
    },
  );
  it('locks confidential attempts by document and actor and denies only that actor after five attempts', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findFirst = vi.fn().mockResolvedValue(null);
    const count = vi.fn().mockResolvedValue(5);
    const create = vi.fn();
    const transaction = vi.fn(
      async (callback: (client: unknown) => Promise<boolean>) =>
        callback({
          $queryRaw: queryRaw,
          documentAuditEvent: { findFirst, count, create },
        }),
    );
    const repository = new DocumentsRepository(
      { client: { $transaction: transaction } } as unknown as DatabaseService,
      {} as NotificationsService,
    );
    const allowed = await repository.beginConfidentialAccessAttempt({
      documentId: '44444444-4444-4444-8444-444444444444',
      actorUserId: '11111111-1111-4111-8111-111111111111',
      actorBranchId: '33333333-3333-4333-8333-333333333333',
      ipSummary: '',
      userAgentSummary: '',
    });
    expect(allowed).toBe(false);
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorUserId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
    expect(create).not.toHaveBeenCalled();
    count.mockResolvedValueOnce(0);
    expect(
      await repository.beginConfidentialAccessAttempt({
        documentId: '44444444-4444-4444-8444-444444444444',
        actorUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        actorBranchId: '33333333-3333-4333-8333-333333333333',
        ipSummary: '',
        userAgentSummary: '',
      }),
    ).toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });
  it('hides sensitive documents from direct detail lookup when not authorized', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new DocumentsRepository(
      { client: { document: { findFirst } } } as unknown as DatabaseService,
      {} as NotificationsService,
    );

    await repository.findDetail('document-a', ['branch-a'], false, 'user-a');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'document-a',
          confidentiality: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] },
          NOT: {
            sourceModule: 'WORKBENCH',
            sourceEntityType: 'WorkbenchFeedback',
            ownerUserId: { not: 'user-a' },
          },
        }),
      }),
    );
  });

  it('hides sensitive documents from favorites without sensitive-read permission', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new DocumentsRepository(
      { client: { document: { findMany } } } as unknown as DatabaseService,
      {} as NotificationsService,
    );

    await repository.favoriteDocuments(
      'user-a',
      ['branch-a'],
      ['GENERAL'],
      false,
      'user-a',
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          confidentiality: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] },
          NOT: {
            sourceModule: 'WORKBENCH',
            sourceEntityType: 'WorkbenchFeedback',
            ownerUserId: { not: 'user-a' },
          },
        }),
      }),
    );
  });

  it('keeps WorkbenchFeedback owner-only even for sensitive readers', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new DocumentsRepository(
      { client: { document: { findFirst } } } as unknown as DatabaseService,
      {} as NotificationsService,
    );

    await repository.findDetail(
      'feedback-document',
      ['branch-a'],
      true,
      'user-a',
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'feedback-document',
          NOT: {
            sourceModule: 'WORKBENCH',
            sourceEntityType: 'WorkbenchFeedback',
            ownerUserId: { not: 'user-a' },
          },
        }),
      }),
    );
  });

  it('applies the same visibility rules to bulk ID lookups', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new DocumentsRepository(
      { client: { document: { findMany } } } as unknown as DatabaseService,
      {} as NotificationsService,
    );

    await repository.findDetails(['document-a'], ['branch-a'], false, 'user-a');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['document-a'] },
          confidentiality: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] },
          NOT: {
            sourceModule: 'WORKBENCH',
            sourceEntityType: 'WorkbenchFeedback',
            ownerUserId: { not: 'user-a' },
          },
        }),
      }),
    );
  });

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
    expect(count.mock.calls[0]?.[0].where.AND).toContainEqual({
      confidentiality: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] },
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

  it('excludes coded documents from raw metadata search and sensitive ordering', async () => {
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
    for (const query of [
      { search: 'secret title', sortBy: 'updatedAt' as const },
      { sortBy: 'title' as const },
      { sortBy: 'archiveCode' as const },
      { sortBy: 'sizeBytes' as const },
      { sortBy: 'validUntil' as const },
    ]) {
      await repository.list(
        { ...query, page: 1, pageSize: 20, sortDirection: 'asc' },
        ['branch-a'],
        ['GENERAL'],
        'reader-a',
        true,
      );
      const where = count.mock.lastCall?.[0].where;
      expect(where.AND).toContainEqual({ confidentialAccessCodeHash: null });
      expect(findMany.mock.lastCall?.[0].where).toEqual(where);
    }
  });

  it.each([
    ['no filters', {}],
    ['search', { search: 'agreement' }],
    ['owner', { ownerUserId: 'another-user' }],
    [
      'source',
      {
        sourceModule: 'SALES',
        sourceEntityType: 'Contract',
        sourceEntityId: 'contract-a',
      },
    ],
    ['category', { categoryId: 'category-a' }],
    ['type', { typeCode: 'CONTRACT' }],
    ['branch', { branchId: 'branch-a' }],
    ['archive status', { archiveStatus: 'ARCHIVED' }],
    ['scan status', { scanStatus: 'CLEAN' }],
    ['validity', { validity: 'EXPIRED' }],
    ['completion', { completion: 'INCOMPLETE' }],
    ['attention', { attention: 'INCOMPLETE_OR_EXPIRED' }],
    ['created range', { createdFrom: '2026-09-01', createdTo: '2026-09-30' }],
    ['owned personal view', { personalView: 'OWNED' }],
    ['uploaded personal view', { personalView: 'UPLOADED' }],
    ['recently viewed personal view', { personalView: 'RECENTLY_VIEWED' }],
    ['public confidentiality', { confidentiality: 'PUBLIC' }],
    ['internal confidentiality', { confidentiality: 'INTERNAL' }],
  ] as const)(
    'always excludes sensitive documents for %s',
    async (_name, filter) => {
      const count = vi.fn().mockResolvedValue(0);
      const findMany = vi.fn().mockResolvedValue([]);
      const repository = new DocumentsRepository(
        {
          client: {
            document: { count, findMany },
            $transaction: (operations: Promise<unknown>[]) =>
              Promise.all(operations),
          },
        } as unknown as DatabaseService,
        {} as NotificationsService,
      );
      const query: Parameters<DocumentsRepository['list']>[0] = {
        page: 1,
        pageSize: 25,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        ...filter,
      };

      await repository.list(
        query,
        ['branch-a', 'branch-b'],
        ['GENERAL'],
        'reader-a',
        false,
      );

      const countWhere = count.mock.calls[0]?.[0].where;
      const listWhere = findMany.mock.calls[0]?.[0].where;
      expect(countWhere).toBe(listWhere);
      expect(countWhere.AND).toContainEqual({
        confidentiality: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] },
      });
    },
  );

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
