import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { DocumentsService } from '../documents/documents.service';

/** Documents remains the owner of file contents, access, scan and versions. */
@Injectable()
export class B2bAgreementDocuments {
  constructor(
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}

  async assertDraftReference(
    documentId: string,
    organizationId: string,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    if (
      !actor.branchIds.includes(branchId) ||
      ![
        'documents.list',
        'documents.organization.read',
        'documents.metadata.read',
      ].every((permission) =>
        actor.permissions.includes(
          permission as (typeof actor.permissions)[number],
        ),
      )
    )
      throw new ForbiddenException({
        code: 'B2B_DOCUMENT_PERMISSION_DENIED',
        message: 'مجوز اتصال سند سازمان در این شعبه را ندارید.',
      });
    // The public exact-source query prevents accepting an arbitrary UUID or another organization's file.
    for (let page = 1; page <= 10; page++) {
      const response = await this.documents.list(
        {
          sourceModule: 'master-data',
          sourceEntityType: 'organizations',
          sourceEntityId: organizationId,
          branchId,
          domain: 'ORGANIZATION',
          archiveStatus: 'ACTIVE',
          page,
          pageSize: 100,
        },
        actor,
      );
      const record = response.data.find((item) => item.id === documentId);
      if (
        record &&
        record.branchId === branchId &&
        record.type.domain === 'ORGANIZATION' &&
        record.archiveStatus === 'ACTIVE'
      ) {
        if (
          record.currentVersion.scanStatus !== 'CLEAN' ||
          record.isIncomplete ||
          (record.validUntil !== null &&
            (!Number.isFinite(Date.parse(record.validUntil)) ||
              Date.parse(record.validUntil) <= Date.now()))
        )
          throw new ConflictException({
            code: 'B2B_DOCUMENT_NOT_READY',
            message: 'سند باید کامل، معتبر و دارای بررسی امنیتی موفق باشد.',
          });
        return { documentId: record.id, versionId: record.currentVersion.id };
      }
      if (page >= response.meta.totalPages) break;
    }
    throw new ConflictException({
      code: 'B2B_DOCUMENT_REFERENCE_INVALID',
      message: 'سند مجاز و مرتبط با این سازمان و شعبه یافت نشد.',
    });
  }
}
