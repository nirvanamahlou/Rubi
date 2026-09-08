import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@rubi/contracts';
import type { DatabaseService } from '../database/database.service';
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
    const repository = new DocumentsRepository({
      client: { documentVersion: { findMany } },
    } as unknown as DatabaseService);
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
  });
  it('resolves old pinned versions in deduplicated owner batches without cross-module table access', async () => {
    const lookup = vi.fn(async (ids: string[]) =>
      ids.map((id) => ({ versionId: id, documentId: `document-${id}` })),
    );
    const boundary = new B2bAgreementDocuments({
      organizationVersionReferences: lookup,
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
});
