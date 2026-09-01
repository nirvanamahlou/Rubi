import { Inject, Injectable } from '@nestjs/common';
import type { DocumentDomainCode, DocumentListQueryV1 } from '@rubi/contracts';
import { AuditOutcome, type Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

export const documentListInclude = {
  documentType: {
    select: { id: true, code: true, name: true, domain: true },
  },
  category: { select: { id: true, code: true, name: true } },
  owner: { select: { id: true, displayName: true } },
  currentVersion: {
    include: { createdBy: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.DocumentInclude;

export const documentDetailInclude = {
  ...documentListInclude,
  versions: {
    include: { createdBy: { select: { id: true, displayName: true } } },
    orderBy: { versionNumber: 'desc' as const },
  },
  relations: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.DocumentInclude;

export type DocumentListRow = Prisma.DocumentGetPayload<{
  include: typeof documentListInclude;
}>;
export type DocumentDetailRow = Prisma.DocumentGetPayload<{
  include: typeof documentDetailInclude;
}>;

const domainPermission: Readonly<
  Record<Exclude<DocumentDomainCode, 'GENERAL'>, string>
> = {
  CUSTOMER_IDENTITY: 'documents.customer_identity.read',
  SALES: 'documents.sales.read',
  TRAVEL: 'documents.travel.read',
  PROCUREMENT: 'documents.procurement.read',
  FINANCE: 'documents.finance.read',
  HUMAN_RESOURCES: 'documents.hr.read',
  ORGANIZATION: 'documents.organization.read',
  REPORTING: 'documents.reporting.read',
  BRAND: 'documents.brand.read',
};

export function allowedDocumentDomains(
  permissions: readonly string[],
): DocumentDomainCode[] {
  return [
    'GENERAL',
    ...Object.entries(domainPermission)
      .filter(([, permission]) => permissions.includes(permission))
      .map(([domain]) => domain as Exclude<DocumentDomainCode, 'GENERAL'>),
  ];
}

function dateAtEndOfDay(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
  return date;
}

@Injectable()
export class DocumentsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async list(
    query: Required<
      Pick<
        DocumentListQueryV1,
        'page' | 'pageSize' | 'sortBy' | 'sortDirection'
      >
    > &
      DocumentListQueryV1,
    branchIds: readonly string[],
    domains: readonly DocumentDomainCode[],
  ) {
    if (query.domain && !domains.includes(query.domain)) {
      return { rows: [] as DocumentListRow[], total: 0 };
    }
    if (query.branchId && !branchIds.includes(query.branchId)) {
      return { rows: [] as DocumentListRow[], total: 0 };
    }
    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const validity: Prisma.DateTimeNullableFilter | undefined =
      query.validity === 'EXPIRED'
        ? { lt: now }
        : query.validity === 'EXPIRING'
          ? { gte: now, lte: inThirtyDays }
          : query.validity === 'VALID'
            ? { gt: now }
            : query.validity === 'WITHOUT_EXPIRY'
              ? { equals: null }
              : undefined;
    const where: Prisma.DocumentWhereInput = {
      branchId: query.branchId ?? { in: [...branchIds] },
      documentType: {
        domain: { in: query.domain ? [query.domain] : [...domains] },
        ...(query.typeCode ? { code: query.typeCode } : {}),
      },
      ...(query.archiveStatus
        ? { archiveStatus: query.archiveStatus }
        : { archiveStatus: { not: 'DELETED' } }),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.confidentiality
        ? { confidentiality: query.confidentiality }
        : {}),
      ...(validity ? { validUntil: validity } : {}),
      ...(query.scanStatus
        ? { currentVersion: { scanStatus: query.scanStatus } }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom
                ? {
                    gte: new Date(
                      `${query.createdFrom.slice(0, 10)}T00:00:00Z`,
                    ),
                  }
                : {}),
              ...(query.createdTo
                ? { lte: dateAtEndOfDay(query.createdTo) }
                : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              {
                archiveCode: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                currentVersion: {
                  originalFileName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };
    const direction = query.sortDirection;
    const orderBy: Prisma.DocumentOrderByWithRelationInput =
      query.sortBy === 'sizeBytes'
        ? { currentVersion: { sizeBytes: direction } }
        : { [query.sortBy]: direction };
    const [total, rows] = await this.database.client.$transaction([
      this.database.client.document.count({ where }),
      this.database.client.document.findMany({
        where,
        include: documentListInclude,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { rows, total };
  }

  findDetail(id: string, branchIds: readonly string[]) {
    return this.database.client.document.findFirst({
      where: { id, branchId: { in: [...branchIds] } },
      include: documentDetailInclude,
    });
  }

  async options(branchIds: readonly string[], domains: readonly string[]) {
    const [documentTypes, categories, owners] = await Promise.all([
      this.database.client.documentType.findMany({
        where: { isActive: true, domain: { in: [...domains] as never[] } },
        orderBy: [{ domain: 'asc' }, { name: 'asc' }],
      }),
      this.database.client.documentCategory.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.database.client.user.findMany({
        where: {
          status: 'ACTIVE',
          branches: { some: { branchId: { in: [...branchIds] } } },
        },
        select: { id: true, displayName: true },
        orderBy: { displayName: 'asc' },
      }),
    ]);
    return { documentTypes, categories, owners };
  }

  async uploadReferences(input: {
    documentTypeId: string;
    categoryId: string | null;
    ownerUserId: string;
    branchId: string;
  }) {
    const [documentType, category, owner, branch] = await Promise.all([
      this.database.client.documentType.findFirst({
        where: { id: input.documentTypeId, isActive: true },
      }),
      input.categoryId
        ? this.database.client.documentCategory.findFirst({
            where: { id: input.categoryId, isActive: true },
          })
        : Promise.resolve(null),
      this.database.client.user.findFirst({
        where: {
          id: input.ownerUserId,
          status: 'ACTIVE',
          branches: { some: { branchId: input.branchId } },
        },
        select: { id: true },
      }),
      this.database.client.branch.findFirst({
        where: { id: input.branchId, isActive: true },
        select: { id: true },
      }),
    ]);
    return { documentType, category, owner, branch };
  }

  async createUploaded(input: {
    documentId: string;
    versionId: string;
    storageObjectKey: string;
    title: string;
    description: string | null;
    documentTypeId: string;
    categoryId: string | null;
    branchId: string;
    ownerUserId: string;
    sourceModule: string;
    sourceEntityType: string;
    sourceEntityId: string;
    sourceDisplayLabel: string;
    confidentiality: string;
    validUntil: Date | null;
    originalFileName: string;
    safeDownloadName: string;
    detectedMimeType: string;
    extension: string;
    sizeBytes: number;
    sha256: string;
    versionNote: string;
    actorUserId: string;
    actorBranchId: string;
    ipSummary: string;
    userAgentSummary: string;
  }): Promise<DocumentDetailRow> {
    return this.database.client.$transaction(async (transaction) => {
      await transaction.document.create({
        data: {
          id: input.documentId,
          title: input.title,
          description: input.description,
          documentTypeId: input.documentTypeId,
          categoryId: input.categoryId,
          branchId: input.branchId,
          ownerUserId: input.ownerUserId,
          sourceModule: input.sourceModule,
          sourceEntityType: input.sourceEntityType,
          sourceEntityId: input.sourceEntityId,
          confidentiality: input.confidentiality as never,
          validUntil: input.validUntil,
          createdByUserId: input.actorUserId,
          updatedByUserId: input.actorUserId,
        },
      });
      await transaction.documentVersion.create({
        data: {
          id: input.versionId,
          documentId: input.documentId,
          versionNumber: 1,
          storageObjectKey: input.storageObjectKey,
          originalFileName: input.originalFileName,
          safeDownloadName: input.safeDownloadName,
          detectedMimeType: input.detectedMimeType,
          extension: input.extension,
          sizeBytes: BigInt(input.sizeBytes),
          sha256: input.sha256,
          scanStatus: 'AWAITING_ANTIVIRUS_ADAPTER',
          versionNote: input.versionNote,
          createdByUserId: input.actorUserId,
        },
      });
      await transaction.documentRelation.create({
        data: {
          documentId: input.documentId,
          relationType: 'PRIMARY_CASE',
          sourceModule: input.sourceModule,
          sourceEntityType: input.sourceEntityType,
          sourceEntityId: input.sourceEntityId,
          displayLabel: input.sourceDisplayLabel,
        },
      });
      await transaction.documentQuarantine.create({
        data: {
          versionId: input.versionId,
          reasonCode: 'ANTIVIRUS_ADAPTER_UNAVAILABLE',
        },
      });
      await transaction.documentProcessingJob.create({
        data: { versionId: input.versionId, jobType: 'ANTIVIRUS_SCAN' },
      });
      await transaction.document.update({
        where: { id: input.documentId },
        data: { currentVersionId: input.versionId, currentVersionNumber: 1 },
      });
      await transaction.documentAuditEvent.create({
        data: {
          documentId: input.documentId,
          versionId: input.versionId,
          actorUserId: input.actorUserId,
          actorBranchId: input.actorBranchId,
          action: 'documents.upload',
          outcome: AuditOutcome.SUCCESS,
          reason: 'UPLOAD_ACCEPTED_TO_QUARANTINE',
          ipSummary: input.ipSummary,
          userAgentSummary: input.userAgentSummary,
        },
      });
      return transaction.document.findUniqueOrThrow({
        where: { id: input.documentId },
        include: documentDetailInclude,
      });
    });
  }

  appendAudit(input: {
    documentId: string;
    versionId?: string;
    actorUserId: string;
    actorBranchId: string;
    action: string;
    outcome: 'SUCCESS' | 'FAILURE';
    reason: string | null;
    ipSummary: string;
    userAgentSummary: string;
  }) {
    return this.database.client.documentAuditEvent.create({
      data: {
        ...input,
        versionId: input.versionId ?? null,
        outcome: input.outcome,
      },
    });
  }

  audit(documentId: string) {
    return this.database.client.documentAuditEvent.findMany({
      where: { documentId },
      include: { actor: { select: { id: true, displayName: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }
}
