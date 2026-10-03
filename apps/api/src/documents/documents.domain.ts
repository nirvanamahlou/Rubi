import type {
  DocumentArchiveRecord,
  DocumentAsset,
  DocumentScanStatus,
  DocumentUploadSession,
  DocumentVersion,
  UploadSessionStatus,
} from './documents.contracts';

export class DocumentsDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DocumentsDomainError';
  }
}

const uploadTransitions: Readonly<
  Record<UploadSessionStatus, readonly UploadSessionStatus[]>
> = {
  INITIATED: ['UPLOADING', 'CANCELLED', 'EXPIRED'],
  UPLOADING: ['UPLOADED', 'CANCELLED', 'EXPIRED'],
  UPLOADED: ['PENDING_SCAN', 'CANCELLED'],
  PENDING_SCAN: ['CLEAN', 'INFECTED', 'SCAN_FAILED', 'QUARANTINED'],
  CLEAN: [],
  INFECTED: ['QUARANTINED'],
  SCAN_FAILED: ['PENDING_SCAN', 'QUARANTINED'],
  QUARANTINED: ['PENDING_SCAN'],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionUploadSession(
  current: UploadSessionStatus,
  target: UploadSessionStatus,
): boolean {
  return uploadTransitions[current].includes(target);
}

export function transitionUploadSession(
  session: DocumentUploadSession,
  target: UploadSessionStatus,
): DocumentUploadSession {
  if (!canTransitionUploadSession(session.status, target)) {
    throw new DocumentsDomainError(
      'INVALID_UPLOAD_TRANSITION',
      `Upload session cannot transition from ${session.status} to ${target}.`,
    );
  }
  return { ...session, status: target };
}

export function createNextDocumentVersion(input: {
  currentVersions: readonly DocumentVersion[];
  version: Omit<DocumentVersion, 'versionNumber'>;
}): DocumentVersion {
  const numbers = input.currentVersions.map((item) => item.versionNumber);
  if (new Set(numbers).size !== numbers.length) {
    throw new DocumentsDomainError(
      'DUPLICATE_VERSION_NUMBER',
      'Existing document version numbers must be unique.',
    );
  }
  const nextVersionNumber = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  if (
    input.currentVersions.some(
      (item) =>
        item.id === input.version.id ||
        item.storageObjectKey === input.version.storageObjectKey,
    )
  ) {
    throw new DocumentsDomainError(
      'IMMUTABLE_VERSION_CONFLICT',
      'A new version requires a unique id and immutable object key.',
    );
  }
  return Object.freeze({ ...input.version, versionNumber: nextVersionNumber });
}

export function archiveDocument(input: {
  asset: DocumentAsset;
  actorReference: string;
  reason: string;
  occurredAt: string;
}): { asset: DocumentAsset; record: DocumentArchiveRecord } {
  if (input.asset.archiveStatus === 'ARCHIVED') {
    throw new DocumentsDomainError(
      'DOCUMENT_ALREADY_ARCHIVED',
      'Document is already archived.',
    );
  }
  if (input.reason.trim().length < 5) {
    throw new DocumentsDomainError(
      'ARCHIVE_REASON_REQUIRED',
      'Archive reason must contain at least five characters.',
    );
  }
  return {
    asset: Object.freeze({
      ...input.asset,
      archiveStatus: 'ARCHIVED',
      archivedAt: input.occurredAt,
      updatedAt: input.occurredAt,
    }),
    record: Object.freeze({
      documentId: input.asset.id,
      action: 'ARCHIVE',
      reason: input.reason.trim(),
      actorReference: input.actorReference,
      occurredAt: input.occurredAt,
    }),
  };
}

export function restoreDocument(input: {
  asset: DocumentAsset;
  actorReference: string;
  reason: string;
  occurredAt: string;
}): { asset: DocumentAsset; record: DocumentArchiveRecord } {
  if (input.asset.archiveStatus !== 'ARCHIVED') {
    throw new DocumentsDomainError(
      'DOCUMENT_NOT_ARCHIVED',
      'Only archived documents can be restored.',
    );
  }
  if (input.asset.legalHoldActive) {
    throw new DocumentsDomainError(
      'LEGAL_HOLD_ACTIVE',
      'Restore requires an explicit legal-hold workflow decision.',
    );
  }
  if (input.reason.trim().length < 5) {
    throw new DocumentsDomainError(
      'RESTORE_REASON_REQUIRED',
      'Restore reason must contain at least five characters.',
    );
  }
  return {
    asset: Object.freeze({
      ...input.asset,
      archiveStatus: 'ACTIVE',
      archivedAt: null,
      updatedAt: input.occurredAt,
    }),
    record: Object.freeze({
      documentId: input.asset.id,
      action: 'RESTORE',
      reason: input.reason.trim(),
      actorReference: input.actorReference,
      occurredAt: input.occurredAt,
    }),
  };
}

export function canDownloadDocument(input: {
  scanStatus: DocumentScanStatus;
  archiveStatus: DocumentAsset['archiveStatus'];
  authorizationAllowed: boolean;
}): { allowed: boolean; code: string } {
  if (!input.authorizationAllowed) return { allowed: false, code: 'FORBIDDEN' };
  if (input.archiveStatus === 'ARCHIVED')
    return { allowed: false, code: 'DOCUMENT_ARCHIVED' };
  if (input.scanStatus !== 'CLEAN') {
    return {
      allowed: false,
      code:
        input.scanStatus === 'QUARANTINED' || input.scanStatus === 'INFECTED'
          ? 'QUARANTINED'
          : 'SCAN_REQUIRED',
    };
  }
  return { allowed: true, code: 'ALLOWED' };
}
