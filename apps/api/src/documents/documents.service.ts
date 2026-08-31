import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

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
  DocumentAuditEventV1,
  DocumentConfidentialityCode,
  DocumentDetailV1,
  DocumentDomainCode,
  DocumentListItemV1,
  DocumentListQueryV1,
  DocumentOptionsResponseV1,
  DocumentSortCode,
  DocumentVersionV1,
} from '@rubi/contracts';

import type { DocumentUploadDto } from './documents.dto';
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
    validUntil: row.validUntil?.toISOString() ?? null,
    currentVersion: mapVersion(
      row.currentVersion as DocumentDetailRow['versions'][number],
    ),
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
  ) {}

  private assertDomain(
    domain: DocumentDomainCode,
    permissions: readonly string[],
  ): void {
    if (!allowedDocumentDomains(permissions).includes(domain)) {
      throw new ForbiddenException('دسترسی به دامنه این سند مجاز نیست.');
    }
  }

  async list(query: DocumentListQueryV1, actor: AuthenticatedActor) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 25));
    const sortBy = validSortFields.has(query.sortBy ?? 'updatedAt')
      ? (query.sortBy ?? 'updatedAt')
      : 'updatedAt';
    const normalized = {
      ...query,
      ...(query.search ? { search: query.search.trim().slice(0, 120) } : {}),
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
        viewFile:
          permissions.includes('documents.file.read') && sensitiveAllowed,
        download:
          permissions.includes('documents.file.read') &&
          permissions.includes('documents.download') &&
          (!sensitive || permissions.includes('documents.sensitive.download')),
        uploadVersion: permissions.includes('documents.version.create'),
        editMetadata: permissions.includes('documents.metadata.update'),
        viewAudit: permissions.includes('documents.audit.read'),
        archive: permissions.includes('documents.delete'),
        restore: permissions.includes('documents.restore'),
      },
    };
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
        sourceModule: dto.sourceModule.trim(),
        sourceEntityType: dto.sourceEntityType.trim(),
        sourceEntityId: dto.sourceEntityId.trim(),
        sourceDisplayLabel: dto.sourceDisplayLabel.trim(),
        confidentiality:
          dto.confidentiality ?? references.documentType.defaultConfidentiality,
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
    const allowed =
      actor.permissions.includes('documents.file.read') &&
      actor.permissions.includes('documents.download') &&
      (!sensitive ||
        (actor.permissions.includes('documents.sensitive.download') &&
          (metadata.sensitiveReason?.trim().length ?? 0) >= 5)) &&
      row.archiveStatus === 'ACTIVE' &&
      row.currentVersion.scanStatus === 'CLEAN';
    await this.repository.appendAudit({
      documentId: row.id,
      versionId: row.currentVersion.id,
      actorUserId: actor.userId,
      actorBranchId: row.branchId,
      action: 'documents.download',
      outcome: allowed ? 'SUCCESS' : 'FAILURE',
      reason: allowed
        ? metadata.sensitiveReason?.trim() || null
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
    const allowed =
      actor.permissions.includes('documents.file.read') &&
      sensitiveAllowed &&
      row.archiveStatus === 'ACTIVE' &&
      row.currentVersion.scanStatus === 'CLEAN' &&
      previewable;

    const denialReason =
      row.currentVersion.scanStatus !== 'CLEAN'
        ? 'PREVIEW_SCAN_BLOCKED'
        : !previewable
          ? 'PREVIEW_TYPE_UNSUPPORTED'
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
}
