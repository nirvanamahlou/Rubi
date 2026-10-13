import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DocumentsService } from '../documents/documents.service';

/** Documents remains the owner of file contents, access, scan and versions. */
@Injectable()
export class B2bAgreementDocuments {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}

  async referenceMap(
    versionIds: readonly string[],
    organizationId: string,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    const result = new Map<string, string>();
    const unique = [...new Set(versionIds)];
    for (let i = 0; i < unique.length; i += 200) {
      const rows = await this.documents.organizationProofVersionReferences(
        unique.slice(i, i + 200),
        organizationId,
        branchId,
        actor,
      );
      for (const row of rows) result.set(row.versionId, row.documentId);
    }
    return result;
  }

  async assertDraftReference(
    documentId: string,
    organizationId: string,
    branchId: string,
    actor: AuthenticatedActor,
    allowPendingScan = false,
    expectedVersionId?: string | null,
    confidentialGrantToken?: string,
  ) {
    return this.documents.assertOrganizationProofReference(
      {
        documentId,
        organizationId,
        branchId,
        ...(expectedVersionId !== undefined ? { expectedVersionId } : {}),
        allowPendingScan,
        ...(confidentialGrantToken ? { confidentialGrantToken } : {}),
      },
      actor,
    );
  }
}
