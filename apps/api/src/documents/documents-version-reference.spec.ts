import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';
import { B2bAgreementDocuments } from '../b2b/b2b-agreement-documents';

const actor: AuthenticatedActor = {
  userId: 'actor',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [
    'documents.list',
    'documents.organization.read',
    'documents.metadata.read',
  ],
};
describe('public organization document version references', () => {
  it('enforces branch access and redacts references without document read permissions', async () => {
    const repository = { organizationVersionReferences: vi.fn() };
    const service = { repository } as unknown as DocumentsService;
    await expect(
      DocumentsService.prototype.organizationVersionReferences.call(
        service,
        ['version'],
        'organization',
        'outside',
        actor,
      ),
    ).rejects.toThrow('شعبه');
    expect(
      await DocumentsService.prototype.organizationVersionReferences.call(
        service,
        ['version'],
        'organization',
        'branch',
        { ...actor, permissions: [] },
      ),
    ).toEqual([]);
    expect(repository.organizationVersionReferences).not.toHaveBeenCalled();
  });
  it('returns only reference IDs through the owner with bounded batches', async () => {
    const repository = {
      organizationVersionReferences: vi
        .fn()
        .mockResolvedValue([{ versionId: 'version', documentId: 'document' }]),
    };
    const service = { repository } as unknown as DocumentsService;
    expect(
      await DocumentsService.prototype.organizationVersionReferences.call(
        service,
        ['version'],
        'organization',
        'branch',
        actor,
      ),
    ).toEqual([{ versionId: 'version', documentId: 'document' }]);
    expect(repository.organizationVersionReferences).toHaveBeenCalledWith(
      ['version'],
      'organization',
      'branch',
      false,
    );
    const sensitiveReader = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.sensitive.read',
      ] as AuthenticatedActor['permissions'],
    };
    await DocumentsService.prototype.organizationVersionReferences.call(
      service,
      ['version'],
      'organization',
      'branch',
      sensitiveReader,
    );
    expect(repository.organizationVersionReferences).toHaveBeenLastCalledWith(
      ['version'],
      'organization',
      'branch',
      true,
    );
    await expect(
      DocumentsService.prototype.organizationVersionReferences.call(
        service,
        Array.from({ length: 201 }, (_, i) => String(i)),
        'organization',
        'branch',
        actor,
      ),
    ).rejects.toThrow('بیش از حد');
  });
  it('filters owner persistence by exact primary case, organization domain, branch and non-deleted document', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: 'version', documentId: 'document' }]);
    const repository = new DocumentsRepository(
      {
        client: { documentVersion: { findMany } },
      } as unknown as DatabaseService,
      { createWithinTransaction: vi.fn() } as unknown as NotificationsService,
    );
    expect(
      await repository.organizationVersionReferences(
        ['version'],
        'organization',
        'branch',
      ),
    ).toEqual([{ versionId: 'version', documentId: 'document' }]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['version'] },
        document: {
          branchId: 'branch',
          archiveStatus: { not: 'DELETED' },
          confidentialAccessCodeHash: null,
          confidentiality: { notIn: ['CONFIDENTIAL', 'RESTRICTED'] },
          documentType: { domain: 'ORGANIZATION' },
          relations: {
            some: {
              relationType: 'PRIMARY_CASE',
              sourceModule: 'master-data',
              sourceEntityType: 'organizations',
              sourceEntityId: 'organization',
            },
          },
        },
      },
      select: { id: true, documentId: true },
    });
    await repository.organizationVersionReferences(
      ['version'],
      'organization',
      'branch',
      true,
    );
    expect(
      findMany.mock.calls[1]?.[0].where.document.confidentiality,
    ).toBeUndefined();
  });
  it('resolves old pinned versions in deduplicated owner batches without cross-module table access', async () => {
    const lookup = vi.fn(async (ids: string[]) =>
      ids.map((id) => ({ versionId: id, documentId: `document-${id}` })),
    );
    const boundary = new B2bAgreementDocuments({
      organizationProofVersionReferences: lookup,
    } as unknown as DocumentsService);
    const ids = Array.from({ length: 201 }, (_, i) => String(i));
    const result = await boundary.referenceMap(
      [...ids, '0'],
      'organization',
      'branch',
      actor,
    );
    expect(result.size).toBe(201);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(result.get('200')).toBe('document-200');
  });
  it('maps coded sensitive stored versions without widening metadata', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { id: 'coded-version', documentId: 'coded-document' },
      ]);
    const repository = new DocumentsRepository(
      {
        client: { documentVersion: { findMany } },
      } as unknown as DatabaseService,
      { createWithinTransaction: vi.fn() } as unknown as NotificationsService,
    );
    await expect(
      repository.organizationProofVersionReferences(
        ['coded-version'],
        'organization',
        'branch',
        true,
      ),
    ).resolves.toEqual([
      { versionId: 'coded-version', documentId: 'coded-document' },
    ]);
    const documentFilter = findMany.mock.calls[0]?.[0].where.document;
    expect(documentFilter.confidentialAccessCodeHash).toBeUndefined();
    expect(documentFilter.relations.some.sourceEntityId).toBe('organization');
  });
  it('fails closed when opaque stored references need permissions the actor lacks', async () => {
    const repository = {
      organizationProofVersionReferences: vi.fn().mockResolvedValue([]),
    };
    const service = Object.assign(Object.create(DocumentsService.prototype), {
      repository,
    }) as DocumentsService;
    await expect(
      service.organizationProofVersionReferences(
        ['protected-version'],
        'organization',
        'branch',
        { ...actor, permissions: [] },
      ),
    ).rejects.toThrow('مجوز');
    await expect(
      service.organizationProofVersionReferences(
        ['protected-version'],
        'organization',
        'branch',
        actor,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'B2B_DOCUMENT_REFERENCE_PERMISSION_DENIED',
      }),
    });
  });
});
