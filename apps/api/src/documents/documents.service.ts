import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { ActivityWindow } from '../common/organization-activity';
import type { Readable } from 'node:stream';
import { HrDirectoryService } from '../hr/hr-directory.service';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  DocumentAccessGrantResponseV1,
  DocumentAccessPurposeCode,
  DocumentCaseOptionsQueryV1,
  DocumentCaseOptionsResponseV1,
  DocumentAuditEventV1,
  DocumentBulkActionInputV1,
  DocumentBulkActionResponseV1,
  DocumentConfidentialityCode,
  DocumentDetailV1,
  DocumentDomainCode,
  DocumentListItemV1,
  DocumentListQueryV1,
  DocumentOptionsResponseV1,
  DocumentSortCode,
  DocumentVersionV1,
} from '@rubi/contracts';

import type {
  DocumentAccessGrantDto,
  DocumentArchiveActionDto,
  DocumentDeleteDto,
  DocumentUpdateDto,
  DocumentUploadDto,
} from './documents.dto';
import { IAM_STEP_UP_PORT, type IamStepUpPort } from '../iam/iam-step-up.port';
import {
  allowedDocumentDomains,
  type DocumentDetailRow,
  type DocumentListRow,
  DocumentsRepository,
} from './documents.repository';
import { DocumentsScanProcessor } from './documents.scan-processor';
import { LocalDocumentStorage } from './documents.storage';
import {
  MAX_DOCUMENT_SIZE_BYTES,
  validateUploadFile,
} from './documents.validation';

export interface UploadedDocumentFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface DocumentRequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  sensitiveReason?: string;
  accessGrantToken?: string;
}

const validSortFields = new Set<DocumentSortCode>([
  'createdAt',
  'updatedAt',
  'title',
  'archiveCode',
  'validUntil',
  'sizeBytes',
]);

function detectMimeType(file: UploadedDocumentFile): string {
  const bytes = file.buffer;
  if (bytes.subarray(0, 4).equals(Buffer.from('%PDF')))
    return 'application/pdf';
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    file.mimetype.includes('openxmlformats')
  )
    return file.mimetype;
  if (
    file.mimetype.startsWith('text/') &&
    !bytes.subarray(0, Math.min(bytes.length, 1024)).includes(0)
  )
    return file.mimetype;
  return 'application/octet-stream';
}

function maskReference(value: string | null): string | null {
  if (!value) return null;
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

function maskHash(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function summarizeIp(value?: string): string {
  if (!value) return 'unknown';
  const normalized = value.replace(/^::ffff:/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    const parts = normalized.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  }
  return normalized.includes(':')
    ? `${normalized.split(':').slice(0, 3).join(':')}:…`
    : 'masked';
}

function summarizeUserAgent(value?: string): string {
  return (value?.replace(/[\r\n]/g, ' ').trim() || 'unknown').slice(0, 240);
}

function mapVersion(
  row: DocumentDetailRow['versions'][number],
): DocumentVersionV1 {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    originalFileName: row.originalFileName,
    safeDownloadName: row.safeDownloadName,
    detectedMimeType: row.detectedMimeType,
    extension: row.extension,
    sizeBytes: Number(row.sizeBytes),
    sha256Masked: maskHash(row.sha256),
    scanStatus: row.scanStatus,
    versionNote: row.versionNote,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

function canReadSensitive(
  confidentiality: DocumentConfidentialityCode,
  permissions: readonly string[],
): boolean {
  return (
    (confidentiality !== 'CONFIDENTIAL' && confidentiality !== 'RESTRICTED') ||
    permissions.includes('documents.sensitive.read')
  );
}

const previewableImageMimeTypes = new Set(['image/jpeg', 'image/png']);

export interface DocumentFileDelivery {
  stream: Readable;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

function mapListItem(
  row: DocumentListRow,
  permissions: readonly string[],
): DocumentListItemV1 {
  if (!row.currentVersion) {
    throw new ConflictException('نسخه جاری سند نامعتبر است.');
  }
  const sensitiveAllowed = canReadSensitive(row.confidentiality, permissions);
  return {
    id: row.id,
    archiveCode: row.archiveCode,
    title: sensitiveAllowed ? row.title : 'سند محرمانه ••••••',
    description: sensitiveAllowed ? row.description : null,
    type: row.documentType,
    category: row.category,
    owner: row.owner,
    branchId: row.branchId,
    confidentiality: row.confidentiality,
    archiveStatus: row.archiveStatus,
    isIncomplete: row.isIncomplete,
    requiresStepUpVerification: row.requiresStepUpVerification,
    validUntil: row.validUntil?.toISOString() ?? null,
    version: row.version,
    currentVersion: mapVersion(
      row.currentVersion as DocumentDetailRow['versions'][number],
    ),
    capabilities: {
      viewFile: permissions.includes('documents.file.read') && sensitiveAllowed,
      download:
        permissions.includes('documents.file.read') &&
        permissions.includes('documents.download') &&
        sensitiveAllowed,
      uploadVersion: permissions.includes('documents.version.create'),
      editMetadata: permissions.includes('documents.metadata.update'),
      viewAudit: permissions.includes('documents.audit.read'),
      archive:
        permissions.includes('documents.delete') &&
        row.archiveStatus === 'ACTIVE',
      restore:
        permissions.includes('documents.restore') &&
        row.archiveStatus === 'ARCHIVED' &&
        !row.legalHoldActive,
      markIncomplete: permissions.includes('documents.metadata.update'),
      permanentDelete:
        permissions.includes('documents.delete') && !row.legalHoldActive,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DocumentsRepository)
    private readonly repository: DocumentsRepository,
    @Inject(LocalDocumentStorage)
    private readonly storage: LocalDocumentStorage,
    @Inject(DocumentsScanProcessor)
    private readonly scanProcessor: DocumentsScanProcessor,
    @Inject(IAM_STEP_UP_PORT)
    private readonly iamStepUp: IamStepUpPort,
    @Inject(HrDirectoryService)
    private readonly hrDirectory: HrDirectoryService,
  ) {}

  private assertDomain(
    domain: DocumentDomainCode,
    permissions: readonly string[],
  ): void {
    if (!allowedDocumentDomains(permissions).includes(domain)) {
      throw new ForbiddenException('دسترسی به دامنه این سند مجاز نیست.');
    }
  }

  /** Public ownership/reference check; Workbench never reads Documents tables. */
  async assertWorkbenchFeedbackAttachments(
    documentIds: readonly string[],
    feedbackId: string,
    branchId: string,
    actor: AuthenticatedActor,
  ): Promise<void> {
    if (!documentIds.length) return;
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه فایل در دامنه دسترسی نیست.');
    const uniqueIds = [...new Set(documentIds)];
    const matches = await this.repository.feedbackAttachmentIds({
      documentIds: uniqueIds,
      feedbackId,
      branchId,
      ownerUserId: actor.userId,
    });
    if (matches.length !== uniqueIds.length) {
      throw new BadRequestException(
        'یک یا چند فایل پیوست متعلق به این نظرسنجی نیست.',
      );
    }
  }

  /** Public reference-only lookup; file contents and metadata stay inside Documents. */
  async organizationVersionReferences(
    versionIds: readonly string[],
    organizationId: string,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    if (!actor.branchIds.includes(branchId))
      throw new ForbiddenException('شعبه سند در دامنه دسترسی نیست.');
    if (
      ![
        'documents.list',
        'documents.organization.read',
        'documents.metadata.read',
      ].every((code) =>
        actor.permissions.includes(code as (typeof actor.permissions)[number]),
      )
    )
      return [];
    if (versionIds.length > 200)
      throw new BadRequestException(
        'تعداد نسخه‌های درخواست‌شده بیش از حد مجاز است.',
      );
    if (!versionIds.length) return [];
    return this.repository.organizationVersionReferences(
      versionIds,
      organizationId,
      branchId,
    );
  }

  async list(query: DocumentListQueryV1, actor: AuthenticatedActor) {
    const sourceReference = [
      query.sourceModule,
      query.sourceEntityType,
      query.sourceEntityId,
    ];
    const suppliedSourceFields = sourceReference.filter(
      (value) => value !== undefined,
    ).length;
    const normalizedSourceReference = sourceReference.map((value) =>
      value?.trim(),
    );
    if (
      suppliedSourceFields !== 0 &&
      (suppliedSourceFields !== 3 ||
        normalizedSourceReference.some((value) => !value))
    ) {
      throw new BadRequestException({
        code: 'DOCUMENT_SOURCE_FILTER_INCOMPLETE',
        message: 'مرجع پرونده برای فیلتر اسناد باید کامل باشد.',
      });
    }
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 25));
    const sortBy = validSortFields.has(query.sortBy ?? 'updatedAt')
      ? (query.sortBy ?? 'updatedAt')
      : 'updatedAt';
    const normalized = {
      ...query,
      ...(query.search ? { search: query.search.trim().slice(0, 120) } : {}),
      ...(suppliedSourceFields === 3
        ? {
            sourceModule: normalizedSourceReference[0]!,
            sourceEntityType: normalizedSourceReference[1]!,
            sourceEntityId: normalizedSourceReference[2]!,
          }
        : {}),
      page,
      pageSize,
      sortBy,
      sortDirection: query.sortDirection === 'asc' ? 'asc' : 'desc',
    } as const;
    const { rows, total } = await this.repository.list(
      normalized,
      actor.branchIds,
      allowedDocumentDomains(actor.permissions),
      actor.userId,
    );
    return {
      data: rows.map((row) => mapListItem(row, actor.permissions)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async options(actor: AuthenticatedActor): Promise<DocumentOptionsResponseV1> {
    const values = await this.repository.options(
      actor.branchIds,
      allowedDocumentDomains(actor.permissions),
    );
    const documentTypes = values.documentTypes.map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
      domain: type.domain,
      defaultConfidentiality: type.defaultConfidentiality,
      allowedMimeTypes: type.allowedMimeTypes,
      maxFileSizeBytes: Number(type.maxFileSizeBytes),
      requiresExpiry: type.requiresExpiry,
    }));
    return {
      data: {
        currentUserId: actor.userId,
        branches: values.branches,
        documentTypes,
        categories: values.categories.map(({ id, code, name }) => ({
          id,
          code,
          name,
        })),
        owners: values.owners,
        uploadPolicy: {
          maxFileSizeBytes: Math.min(
            MAX_DOCUMENT_SIZE_BYTES,
            ...documentTypes.map((type) => type.maxFileSizeBytes),
          ),
          allowedMimeTypes: [
            ...new Set(documentTypes.flatMap((type) => type.allowedMimeTypes)),
          ],
          antivirusAvailable: this.scanProcessor.available,
        },
      },
    };
  }

  async caseOptions(
    query: DocumentCaseOptionsQueryV1,
    actor: AuthenticatedActor,
  ): Promise<DocumentCaseOptionsResponseV1> {
    if (!actor.branchIds.includes(query.branchId)) {
      throw new ForbiddenException('شعبه انتخاب‌شده خارج از دسترسی کاربر است.');
    }
    const limit = Math.min(50, Math.max(10, query.limit ?? 20));
    const { rows, hasMore } = await this.repository.caseOptions({
      branchId: query.branchId,
      domains: allowedDocumentDomains(actor.permissions),
      includeSensitive: actor.permissions.includes('documents.sensitive.read'),
      search: query.search?.trim().slice(0, 120) ?? '',
      limit,
    });
    return {
      data: rows.map(({ id, displayLabel }) => ({ id, displayLabel })),
      meta: { hasMore, limit },
    };
  }

  async detail(
    id: string,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<{ data: DocumentDetailV1 }> {
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row) throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    await this.repository.appendAudit({
      documentId: row.id,
      ...(row.currentVersionId ? { versionId: row.currentVersionId } : {}),
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      action: 'documents.metadata.view',
      outcome: 'SUCCESS',
      reason: canReadSensitive(row.confidentiality, actor.permissions)
        ? metadata.sensitiveReason?.trim() || null
        : 'SENSITIVE_METADATA_MASKED',
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });
    return { data: this.mapDetail(row, actor.permissions) };
  }

  private mapDetail(
    row: DocumentDetailRow,
    permissions: readonly string[],
  ): DocumentDetailV1 {
    const base = mapListItem(row, permissions);
    const sensitive =
      row.confidentiality === 'CONFIDENTIAL' ||
      row.confidentiality === 'RESTRICTED';
    const sensitiveAllowed = canReadSensitive(row.confidentiality, permissions);
    return {
      ...base,
      sourceModule: row.sourceModule,
      sourceEntityType: row.sourceEntityType,
      sourceEntityIdMasked: sensitiveAllowed
        ? maskReference(row.sourceEntityId)
        : '••••',
      legalHoldActive: row.legalHoldActive,
      versions: row.versions.map(mapVersion),
      relations: row.relations.map((relation) => ({
        id: relation.id,
        relationType: relation.relationType,
        sourceModule: relation.sourceModule,
        sourceEntityType: relation.sourceEntityType,
        sourceEntityIdMasked: maskReference(relation.sourceEntityId) ?? '••••',
        displayLabel: sensitiveAllowed
          ? relation.displayLabel
          : 'پرونده محرمانه',
      })),
      capabilities: {
        ...base.capabilities,
        download:
          base.capabilities.download &&
          (!sensitive || permissions.includes('documents.sensitive.download')),
      },
    };
  }

  private assertPermission(
    permissions: readonly string[],
    permission: string,
  ): void {
    if (!permissions.includes(permission)) {
      throw new ForbiddenException('مجوز لازم برای این عملیات وجود ندارد.');
    }
  }

  async update(
    id: string,
    dto: DocumentUpdateDto,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<{ data: DocumentDetailV1 }> {
    this.assertPermission(actor.permissions, 'documents.metadata.update');
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row) throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    if (row.archiveStatus === 'DELETED') {
      throw new ConflictException('سند حذف‌شده قابل ویرایش نیست.');
    }
    if (row.documentType.requiresExpiry && !dto.validUntil) {
      throw new BadRequestException(
        'تاریخ اعتبار برای این نوع سند الزامی است.',
      );
    }
    const references = await this.repository.editReferences({
      categoryId: dto.categoryId,
      ownerUserId: dto.ownerUserId,
      branchId: row.branchId,
    });
    if (!references.category)
      throw new BadRequestException('دسته‌بندی معتبر نیست.');
    if (!references.owner)
      throw new BadRequestException('مالک در شعبه سند معتبر نیست.');
    const updated = await this.repository.updateMetadata({
      documentId: id,
      expectedVersion: dto.version,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      categoryId: dto.categoryId,
      ownerUserId: dto.ownerUserId,
      confidentiality: dto.confidentiality,
      validUntil: dto.validUntil
        ? new Date(`${dto.validUntil.slice(0, 10)}T23:59:59.999Z`)
        : null,
      isIncomplete: dto.isIncomplete,
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });
    if (!updated) {
      throw new ConflictException(
        'سند هم‌زمان تغییر کرده است؛ اطلاعات را دوباره باز کنید.',
      );
    }
    return { data: this.mapDetail(updated, actor.permissions) };
  }

  async archive(
    id: string,
    dto: DocumentArchiveActionDto,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<{ data: DocumentDetailV1 }> {
    this.assertPermission(actor.permissions, 'documents.delete');
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row) throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    if (row.archiveStatus !== 'ACTIVE') {
      throw new ConflictException('فقط سند فعال قابل آرشیو است.');
    }
    const updated = await this.repository.changeArchiveStatus({
      documentId: id,
      expectedVersion: dto.version,
      expectedStatus: 'ACTIVE',
      nextStatus: 'ARCHIVED',
      action: 'documents.archive',
      reason: dto.reason.trim(),
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      ownerUserId: row.ownerUserId,
      documentTitle: row.title,
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });
    if (!updated) throw new ConflictException('سند هم‌زمان تغییر کرده است.');
    return { data: this.mapDetail(updated, actor.permissions) };
  }

  async restore(
    id: string,
    dto: DocumentArchiveActionDto,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<{ data: DocumentDetailV1 }> {
    this.assertPermission(actor.permissions, 'documents.restore');
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row) throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    if (row.archiveStatus !== 'ARCHIVED') {
      throw new ConflictException('فقط سند آرشیوشده قابل بازیابی است.');
    }
    if (row.legalHoldActive) {
      throw new ConflictException('به‌دلیل توقف حقوقی، بازیابی مجاز نیست.');
    }
    const updated = await this.repository.changeArchiveStatus({
      documentId: id,
      expectedVersion: dto.version,
      expectedStatus: 'ARCHIVED',
      nextStatus: 'ACTIVE',
      action: 'documents.restore',
      reason: dto.reason.trim(),
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      ownerUserId: row.ownerUserId,
      documentTitle: row.title,
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });
    if (!updated) throw new ConflictException('سند هم‌زمان تغییر کرده است.');
    return { data: this.mapDetail(updated, actor.permissions) };
  }

  async bulk(
    dto: DocumentBulkActionInputV1,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<DocumentBulkActionResponseV1> {
    const ids = [...new Set(dto.ids)];
    const permission =
      dto.action === 'ARCHIVE'
        ? 'documents.delete'
        : dto.action === 'RESTORE'
          ? 'documents.restore'
          : 'documents.metadata.update';
    this.assertPermission(actor.permissions, permission);
    const rows = await this.repository.findDetails(ids, actor.branchIds);
    if (rows.length !== ids.length) {
      throw new NotFoundException('یک یا چند سند انتخاب‌شده پیدا نشد.');
    }
    for (const row of rows) {
      this.assertDomain(row.documentType.domain, actor.permissions);
      if (dto.action === 'ARCHIVE' && row.archiveStatus !== 'ACTIVE') {
        throw new ConflictException('همه اسناد انتخاب‌شده باید فعال باشند.');
      }
      if (dto.action === 'RESTORE' && row.archiveStatus !== 'ARCHIVED') {
        throw new ConflictException(
          'همه اسناد انتخاب‌شده باید آرشیوشده باشند.',
        );
      }
      if (dto.action === 'RESTORE' && row.legalHoldActive) {
        throw new ConflictException(
          'یکی از اسناد انتخاب‌شده دارای توقف حقوقی است.',
        );
      }
    }
    try {
      const updatedCount = await this.repository.bulkAction({
        rows,
        action: dto.action,
        reason: dto.reason.trim(),
        actorUserId: actor.userId,
        ipSummary: summarizeIp(metadata.ipAddress),
        userAgentSummary: summarizeUserAgent(metadata.userAgent),
      });
      return { data: { updatedCount } };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'DOCUMENT_VERSION_CONFLICT'
      ) {
        throw new ConflictException(
          'یکی از اسناد هم‌زمان تغییر کرده است؛ فهرست را تازه کنید.',
        );
      }
      throw error;
    }
  }

  async permanentlyDelete(
    id: string,
    dto: DocumentDeleteDto,
    actor: AuthenticatedActor,
  ): Promise<void> {
    this.assertPermission(actor.permissions, 'documents.delete');
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row) throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    if (row.legalHoldActive) {
      throw new ConflictException(
        'سند دارای توقف حقوقی است و حذف دائمی آن مجاز نیست.',
      );
    }
    if (dto.reason.trim().length < 5) {
      throw new BadRequestException('دلیل حذف دائمی الزامی است.');
    }
    if (row.version !== dto.version) {
      throw new ConflictException(
        'سند هم‌زمان تغییر کرده است؛ فهرست را تازه کنید.',
      );
    }
    await Promise.all(
      row.versions.map((version) =>
        this.storage.removeQuarantined(version.storageObjectKey),
      ),
    );
    const deleted = await this.repository.permanentlyDelete({
      documentId: id,
      expectedVersion: dto.version,
      actorUserId: actor.userId,
      ownerUserId: row.ownerUserId,
      documentTitle: row.title,
    });
    if (!deleted) {
      throw new ConflictException(
        'سند هم‌زمان تغییر کرده است؛ فهرست را تازه کنید.',
      );
    }
  }

  async upload(
    dto: DocumentUploadDto,
    file: UploadedDocumentFile | undefined,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<{ data: DocumentDetailV1 }> {
    if (!file) throw new BadRequestException('انتخاب فایل الزامی است.');
    if (!actor.branchIds.includes(dto.branchId)) {
      throw new ForbiddenException('شعبه انتخاب‌شده خارج از دسترسی کاربر است.');
    }
    const references = await this.repository.uploadReferences({
      documentTypeId: dto.documentTypeId,
      categoryId: dto.categoryId,
      ownerUserId: dto.ownerUserId,
      branchId: dto.branchId,
    });
    if (!references.documentType)
      throw new BadRequestException('نوع سند معتبر نیست.');
    this.assertDomain(references.documentType.domain, actor.permissions);
    if (!references.category)
      throw new BadRequestException('دسته‌بندی معتبر نیست.');
    if (!references.owner)
      throw new BadRequestException('مالک در شعبه انتخاب‌شده معتبر نیست.');
    if (!references.branch)
      throw new BadRequestException('شعبه انتخاب‌شده فعال نیست.');
    const domains = allowedDocumentDomains(actor.permissions);
    const selectedCase = dto.sourceRelationId
      ? await this.repository.findCaseReference({
          relationId: dto.sourceRelationId,
          branchId: dto.branchId,
          domains,
          includeSensitive: actor.permissions.includes(
            'documents.sensitive.read',
          ),
        })
      : null;
    if (dto.sourceRelationId && !selectedCase) {
      throw new BadRequestException(
        'پرونده انتخاب‌شده معتبر یا در دسترس شما نیست.',
      );
    }
    const sourceReference = selectedCase ?? {
      sourceModule: dto.sourceModule?.trim() ?? '',
      sourceEntityType: dto.sourceEntityType?.trim() ?? '',
      sourceEntityId: dto.sourceEntityId?.trim() ?? '',
      displayLabel: dto.sourceDisplayLabel?.trim() ?? '',
    };
    if (
      sourceReference.sourceModule === 'HUMAN_RESOURCES' &&
      sourceReference.sourceEntityType === 'Employee'
    ) {
      this.assertDomain('HUMAN_RESOURCES', actor.permissions);
      if (references.documentType.domain !== 'HUMAN_RESOURCES')
        throw new BadRequestException(
          'برای پرونده پرسنلی نوع سند منابع انسانی را انتخاب کنید.',
        );
      const employee = await this.hrDirectory.employee(
        sourceReference.sourceEntityId,
        dto.branchId,
        actor,
      );
      sourceReference.displayLabel = `${employee.name} · ${employee.personnelCode}`;
    }
    if (
      !sourceReference.sourceModule ||
      !sourceReference.sourceEntityType ||
      !sourceReference.sourceEntityId ||
      !sourceReference.displayLabel
    ) {
      throw new BadRequestException('انتخاب پرونده مربوطه الزامی است.');
    }
    if (references.documentType.requiresExpiry && !dto.validUntil) {
      throw new BadRequestException(
        'تاریخ اعتبار برای این نوع سند الزامی است.',
      );
    }
    const detectedMimeType = detectMimeType(file);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const openXml = detectedMimeType.includes('openxmlformats');
    const validation = validateUploadFile({
      originalFileName: file.originalname,
      declaredMimeType: file.mimetype,
      detectedMimeType,
      sizeBytes: file.size,
      sha256,
      magicBytes: [...file.buffer.subarray(0, 16)],
      ...(openXml
        ? { archiveEntryCount: 1, archiveUncompressedBytes: file.size }
        : {}),
    });
    if (
      !validation.valid ||
      !references.documentType.allowedMimeTypes.includes(detectedMimeType) ||
      file.size > Number(references.documentType.maxFileSizeBytes)
    ) {
      throw new BadRequestException({
        code: 'DOCUMENT_FILE_REJECTED',
        message: 'فایل با سیاست نوع سند سازگار نیست.',
        errors: validation.errors,
      });
    }
    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageObjectKey = `documents/${documentId}/v1/${randomUUID()}.bin`;
    await this.storage.putQuarantined(storageObjectKey, file.buffer);
    try {
      const row = await this.repository.createUploaded({
        documentId,
        versionId,
        storageObjectKey,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        documentTypeId: references.documentType.id,
        categoryId: references.category.id,
        branchId: dto.branchId,
        ownerUserId: dto.ownerUserId,
        sourceModule: sourceReference.sourceModule,
        sourceEntityType: sourceReference.sourceEntityType,
        sourceEntityId: sourceReference.sourceEntityId,
        sourceDisplayLabel: sourceReference.displayLabel,
        confidentiality:
          dto.confidentiality ?? references.documentType.defaultConfidentiality,
        requiresStepUpVerification: dto.requiresStepUpVerification ?? false,
        validUntil: dto.validUntil
          ? new Date(`${dto.validUntil.slice(0, 10)}T23:59:59.999Z`)
          : null,
        originalFileName: file.originalname,
        safeDownloadName: validation.safeFileName,
        detectedMimeType,
        extension: validation.extension,
        sizeBytes: file.size,
        sha256,
        versionNote: dto.versionNote?.trim() || 'بارگذاری اولیه',
        actorUserId: actor.userId,
        actorBranchId: dto.branchId,
        ipSummary: summarizeIp(metadata.ipAddress),
        userAgentSummary: summarizeUserAgent(metadata.userAgent),
      });
      if (await this.scanProcessor.processVersion(versionId)) {
        const scanned = await this.repository.findDetail(
          documentId,
          actor.branchIds,
        );
        if (scanned)
          return { data: this.mapDetail(scanned, actor.permissions) };
      }
      return { data: this.mapDetail(row, actor.permissions) };
    } catch (error) {
      await this.storage
        .removeQuarantined(storageObjectKey)
        .catch(() => undefined);
      throw error;
    }
  }

  async audit(id: string, actor: AuthenticatedActor) {
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row) throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    const events = await this.repository.audit(id);
    return {
      data: events.map((event): DocumentAuditEventV1 => ({
        id: event.id,
        action: event.action,
        outcome: event.outcome,
        actor: event.actor,
        occurredAt: event.occurredAt.toISOString(),
        reason: event.reason,
        ipSummary: event.ipSummary,
        userAgentSummary: event.userAgentSummary,
      })),
    };
  }

  async organizationActivity(
    org: string,
    branch: string,
    actor: AuthenticatedActor,
    window: ActivityWindow,
  ) {
    if (
      !actor.permissions.includes('documents.audit.read') ||
      !actor.branchIds.includes(branch)
    )
      throw new ForbiddenException('مجوز تاریخچه اسناد یا شعبه را ندارید.');
    return this.repository.organizationActivity(
      org,
      branch,
      actor.permissions,
      window,
    );
  }

  async createAccessGrant(
    id: string,
    dto: DocumentAccessGrantDto,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<DocumentAccessGrantResponseV1> {
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row || !row.currentVersion)
      throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    if (!row.requiresStepUpVerification) {
      await this.auditAccessGrantFailure(
        row,
        actor,
        metadata,
        'STEP_UP_NOT_REQUIRED',
      );
      throw new ConflictException({
        code: 'DOCUMENT_STEP_UP_NOT_REQUIRED',
        message: 'این سند به اعتبارسنجی دومرحله‌ای نیاز ندارد.',
      });
    }
    const sensitive =
      row.confidentiality === 'CONFIDENTIAL' ||
      row.confidentiality === 'RESTRICTED';
    const hasPurposePermission =
      dto.purpose === 'PREVIEW'
        ? actor.permissions.includes('documents.file.read') &&
          (!sensitive || actor.permissions.includes('documents.sensitive.read'))
        : actor.permissions.includes('documents.file.read') &&
          actor.permissions.includes('documents.download') &&
          (!sensitive ||
            actor.permissions.includes('documents.sensitive.download'));
    const previewable =
      dto.purpose !== 'PREVIEW' ||
      previewableImageMimeTypes.has(row.currentVersion.detectedMimeType);
    if (
      !hasPurposePermission ||
      !previewable ||
      row.archiveStatus !== 'ACTIVE' ||
      row.currentVersion.scanStatus !== 'CLEAN'
    ) {
      await this.auditAccessGrantFailure(
        row,
        actor,
        metadata,
        'ACCESS_GRANT_POLICY_DENIED',
      );
      throw new ForbiddenException('دریافت مجوز نمایش این سند مجاز نیست.');
    }
    try {
      await this.iamStepUp.verifyStepUp(actor, dto.code, metadata);
    } catch (error) {
      await this.repository.appendAudit({
        documentId: row.id,
        versionId: row.currentVersion.id,
        actorUserId: actor.userId,
        actorBranchId: row.branchId,
        action: 'documents.access_grant.create',
        outcome: 'FAILURE',
        reason: 'STEP_UP_VERIFICATION_FAILED',
        ipSummary: summarizeIp(metadata.ipAddress),
        userAgentSummary: summarizeUserAgent(metadata.userAgent),
      });
      throw error;
    }
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 2 * 60_000);
    await this.repository.createAccessGrant({
      tokenHash: createHash('sha256').update(token, 'utf8').digest('hex'),
      documentId: row.id,
      actorUserId: actor.userId,
      actorSessionId: actor.sessionId,
      purpose: dto.purpose,
      expiresAt,
    });
    await this.repository.appendAudit({
      documentId: row.id,
      versionId: row.currentVersion.id,
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      action: 'documents.access_grant.create',
      outcome: 'SUCCESS',
      reason: dto.purpose,
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });
    return {
      data: { token, purpose: dto.purpose, expiresAt: expiresAt.toISOString() },
    };
  }

  async download(
    id: string,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<DocumentFileDelivery> {
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row || !row.currentVersion)
      throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);
    const sensitive =
      row.confidentiality === 'CONFIDENTIAL' ||
      row.confidentiality === 'RESTRICTED';
    const baseAllowed =
      actor.permissions.includes('documents.file.read') &&
      actor.permissions.includes('documents.download') &&
      (!sensitive ||
        (actor.permissions.includes('documents.sensitive.download') &&
          (metadata.sensitiveReason?.trim().length ?? 0) >= 5)) &&
      row.archiveStatus === 'ACTIVE' &&
      row.currentVersion.scanStatus === 'CLEAN';
    const stepUpAllowed =
      baseAllowed && row.requiresStepUpVerification
        ? await this.consumeAccessGrant(row.id, actor, 'DOWNLOAD', metadata)
        : true;
    const allowed = baseAllowed && stepUpAllowed;
    await this.repository.appendAudit({
      documentId: row.id,
      versionId: row.currentVersion.id,
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      action: 'documents.download',
      outcome: allowed ? 'SUCCESS' : 'FAILURE',
      reason: allowed
        ? metadata.sensitiveReason?.trim() || null
        : baseAllowed && row.requiresStepUpVerification
          ? 'DOWNLOAD_STEP_UP_DENIED'
          : 'DOWNLOAD_POLICY_DENIED',
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });
    if (!allowed) {
      if (row.currentVersion.scanStatus !== 'CLEAN') {
        throw new ConflictException(
          'فایل تا پایان اسکن امنیتی قابل دریافت نیست.',
        );
      }
      throw new ForbiddenException('دانلود این سند مجاز نیست.');
    }
    return {
      stream: await this.storage.openQuarantined(
        row.currentVersion.storageObjectKey,
        Number(row.currentVersion.sizeBytes),
      ),
      fileName: row.currentVersion.safeDownloadName,
      mimeType: row.currentVersion.detectedMimeType,
      sizeBytes: Number(row.currentVersion.sizeBytes),
    };
  }

  async preview(
    id: string,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
  ): Promise<DocumentFileDelivery> {
    const row = await this.repository.findDetail(id, actor.branchIds);
    if (!row || !row.currentVersion)
      throw new NotFoundException('سند پیدا نشد.');
    this.assertDomain(row.documentType.domain, actor.permissions);

    const sensitive =
      row.confidentiality === 'CONFIDENTIAL' ||
      row.confidentiality === 'RESTRICTED';
    const sensitiveAllowed =
      !sensitive ||
      (actor.permissions.includes('documents.sensitive.read') &&
        (metadata.sensitiveReason?.trim().length ?? 0) >= 5);
    const previewable = previewableImageMimeTypes.has(
      row.currentVersion.detectedMimeType,
    );
    const baseAllowed =
      actor.permissions.includes('documents.file.read') &&
      sensitiveAllowed &&
      row.archiveStatus === 'ACTIVE' &&
      row.currentVersion.scanStatus === 'CLEAN' &&
      previewable;
    const stepUpAllowed =
      baseAllowed && row.requiresStepUpVerification
        ? await this.consumeAccessGrant(row.id, actor, 'PREVIEW', metadata)
        : true;
    const allowed = baseAllowed && stepUpAllowed;

    const denialReason =
      row.currentVersion.scanStatus !== 'CLEAN'
        ? 'PREVIEW_SCAN_BLOCKED'
        : !previewable
          ? 'PREVIEW_TYPE_UNSUPPORTED'
          : baseAllowed && row.requiresStepUpVerification
            ? 'PREVIEW_STEP_UP_DENIED'
            : 'PREVIEW_POLICY_DENIED';
    await this.repository.appendAudit({
      documentId: row.id,
      versionId: row.currentVersion.id,
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      action: 'documents.file.preview',
      outcome: allowed ? 'SUCCESS' : 'FAILURE',
      reason: allowed ? metadata.sensitiveReason?.trim() || null : denialReason,
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });

    if (row.currentVersion.scanStatus !== 'CLEAN') {
      throw new ConflictException(
        'پیش‌نمایش تا پایان اسکن امنیتی فعال نمی‌شود.',
      );
    }
    if (!previewable) {
      throw new UnsupportedMediaTypeException(
        'پیش‌نمایش تصویری فقط برای فایل JPEG یا PNG در دسترس است.',
      );
    }
    if (!allowed) {
      throw new ForbiddenException('مشاهده محتوای این سند مجاز نیست.');
    }

    return {
      stream: await this.storage.openQuarantined(
        row.currentVersion.storageObjectKey,
        Number(row.currentVersion.sizeBytes),
      ),
      fileName: row.currentVersion.safeDownloadName,
      mimeType: row.currentVersion.detectedMimeType,
      sizeBytes: Number(row.currentVersion.sizeBytes),
    };
  }

  private async consumeAccessGrant(
    documentId: string,
    actor: AuthenticatedActor,
    purpose: DocumentAccessPurposeCode,
    metadata: DocumentRequestMetadata,
  ): Promise<boolean> {
    if (!metadata.accessGrantToken) return false;
    return this.repository.consumeAccessGrant({
      tokenHash: createHash('sha256')
        .update(metadata.accessGrantToken, 'utf8')
        .digest('hex'),
      documentId,
      actorUserId: actor.userId,
      actorSessionId: actor.sessionId,
      purpose,
    });
  }

  private auditAccessGrantFailure(
    row: DocumentDetailRow,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
    reason: string,
  ) {
    return this.repository.appendAudit({
      documentId: row.id,
      ...(row.currentVersion ? { versionId: row.currentVersion.id } : {}),
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      action: 'documents.access_grant.create',
      outcome: 'FAILURE',
      reason,
      ipSummary: summarizeIp(metadata.ipAddress),
      userAgentSummary: summarizeUserAgent(metadata.userAgent),
    });
  }
}
