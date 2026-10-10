import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentsService } from '../documents/documents.service';
import { B2bAgreementDocuments } from './b2b-agreement-documents';

const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [
    'documents.list',
    'documents.metadata.read',
    'documents.organization.read',
  ],
};
function setup() {
  const assertOrganizationProofReference = vi
    .fn()
    .mockResolvedValue({ documentId: 'document', versionId: 'version' });
  return {
    assertOrganizationProofReference,
    service: new B2bAgreementDocuments({
      assertOrganizationProofReference,
    } as unknown as DocumentsService),
  };
}
describe('B2B agreement document reference boundary', () => {
  it('delegates draft eligibility, pinned version and confidential grant to Documents', async () => {
    const { service, assertOrganizationProofReference } = setup();
    await service.assertDraftReference(
      'document',
      'organization',
      'branch',
      actor,
      true,
      'version',
      'grant-token',
    );
    expect(assertOrganizationProofReference).toHaveBeenCalledExactlyOnceWith(
      {
        documentId: 'document',
        organizationId: 'organization',
        branchId: 'branch',
        expectedVersionId: 'version',
        allowPendingScan: true,
        confidentialGrantToken: 'grant-token',
      },
      actor,
    );
  });
  it('does not treat opaque stored-reference lookup as attachment authority', async () => {
    const denied = new Error('grant required');
    const { service, assertOrganizationProofReference } = setup();
    assertOrganizationProofReference.mockRejectedValue(denied);
    await expect(
      service.assertDraftReference('document', 'organization', 'branch', actor),
    ).rejects.toBe(denied);
  });
});
