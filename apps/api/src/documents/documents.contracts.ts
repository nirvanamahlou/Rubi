export const DOCUMENTS_CONTRACT_VERSION = 'documents.v1-proposal' as const;
export const DOCUMENTS_PHASE_A_NOTICE =
  'Phase A preview only; persistence, upload completion, download URLs and antivirus results are unavailable.' as const;

export type DocumentCategory =
  | 'SALES_CONTRACT'
  | 'TICKET'
  | 'HOTEL_VOUCHER'
  | 'INSURANCE_POLICY'
  | 'MANIFEST'
  | 'FINANCIAL'
  | 'CUSTOMER_PASSENGER'
  | 'HUMAN_RESOURCES'
  | 'MARKETING'
  | 'GENERAL';

export type ConfidentialityLevel =
  'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type DocumentScanStatus =
  | 'PENDING_SCAN'
  | 'CLEAN'
  | 'INFECTED'
  | 'SCAN_FAILED'
  | 'QUARANTINED'
  | 'AWAITING_ANTIVIRUS_ADAPTER';

export type DocumentArchiveStatus = 'ACTIVE' | 'ARCHIVED';
export type UploadSessionStatus =
  | 'INITIATED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'PENDING_SCAN'
  | 'CLEAN'
  | 'INFECTED'
  | 'SCAN_FAILED'
  | 'QUARANTINED'
  | 'CANCELLED'
  | 'EXPIRED';

export type DocumentAccessAction =
  | 'VIEW'
  | 'DOWNLOAD'
  | 'UPLOAD'
  | 'VERSION_CREATE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'ACCESS_DENIED';

export type DocumentAccessOutcome = 'ALLOWED' | 'DENIED' | 'FAILED';

export interface DocumentReference {
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityId: string;
  displayLabel: string;
}

export interface DocumentVersion {
  readonly id: string;
  readonly documentId: string;
  readonly versionNumber: number;
  readonly storageObjectKey: string;
  readonly originalFileName: string;
  readonly safeDownloadName: string;
  readonly detectedMimeType: string;
  readonly extension: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly scanStatus: DocumentScanStatus;
  readonly versionNote: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface DocumentAsset {
  readonly id: string;
  readonly displayName: string;
  readonly category: DocumentCategory;
  readonly sourceModule: string;
  readonly issuerLegalEntityReference: string | null;
  readonly branchReference: string;
  readonly confidentiality: ConfidentialityLevel;
  readonly archiveStatus: DocumentArchiveStatus;
  readonly currentVersionNumber: number;
  readonly references: readonly DocumentReference[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  readonly proposedDeletionAt: string | null;
  readonly legalHoldActive: boolean;
}

export interface DocumentAccessLog {
  readonly id: string;
  readonly documentId: string;
  readonly versionId: string | null;
  readonly action: DocumentAccessAction;
  readonly outcome: DocumentAccessOutcome;
  readonly actorReference: string;
  readonly occurredAt: string;
  readonly ipSummary: string;
  readonly userAgentSummary: string;
  readonly reason: string | null;
  readonly denialCode: string | null;
}

export interface DocumentArchiveRecord {
  readonly documentId: string;
  readonly action: 'ARCHIVE' | 'RESTORE';
  readonly reason: string;
  readonly actorReference: string;
  readonly occurredAt: string;
}

export interface DocumentRetentionPolicy {
  readonly id: string;
  readonly category: DocumentCategory;
  readonly retentionDays: number | null;
  readonly permanentDeletionEnabled: false;
  readonly status: 'POLICY_PENDING' | 'DRAFT';
}

export interface DocumentLegalHold {
  readonly id: string;
  readonly documentId: string;
  readonly reason: string;
  readonly placedBy: string;
  readonly placedAt: string;
  readonly releasedBy: string | null;
  readonly releasedAt: string | null;
}

export interface DocumentScanResult {
  readonly versionId: string;
  readonly status: DocumentScanStatus;
  readonly adapterReference: string | null;
  readonly scannedAt: string | null;
  readonly engineVersion: string | null;
  readonly threatCode: string | null;
}

export interface DocumentUploadSession {
  readonly id: string;
  readonly status: UploadSessionStatus;
  readonly objectKey: string;
  readonly branchReference: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly expectedSizeBytes: number;
  readonly expectedSha256: string;
}

export const documentSortFields = [
  'createdAt',
  'updatedAt',
  'displayName',
  'sizeBytes',
] as const;
export type DocumentSortField = (typeof documentSortFields)[number];

export interface DocumentListQuery {
  search: string;
  category: DocumentCategory | 'ALL';
  sourceModule: string | null;
  sourceEntityId: string | null;
  issuerLegalEntityReference: string | null;
  confidentiality: ConfidentialityLevel | 'ALL';
  scanStatus: DocumentScanStatus | 'ALL';
  archiveStatus: DocumentArchiveStatus | 'ALL';
  createdBy: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  sortBy: DocumentSortField;
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface PaginatedDocuments<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface DocumentsErrorEnvelope {
  readonly error: {
    readonly code:
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'VALIDATION_ERROR'
      | 'CONFLICT'
      | 'QUARANTINED'
      | 'SCAN_REQUIRED'
      | 'ADAPTER_UNAVAILABLE';
    readonly message: string;
    readonly fieldErrors?: Readonly<Record<string, string>>;
  };
  readonly meta: { readonly requestId: string };
}

export const documentsApplicationOperations = [
  'listDocuments',
  'getDocument',
  'createUploadSession',
  'completeUpload',
  'cancelUpload',
  'createVersion',
  'listVersions',
  'requestAuthorizedDownload',
  'archiveDocument',
  'restoreDocument',
  'listAccessHistory',
  'placeLegalHold',
  'releaseLegalHold',
] as const;
