import type { BranchReference } from '../iam';

export const DOCUMENTS_CONTRACT_VERSION = 1 as const;

export const DOCUMENT_DOMAIN_CODES = [
  'CUSTOMER_IDENTITY',
  'SALES',
  'TRAVEL',
  'PROCUREMENT',
  'FINANCE',
  'HUMAN_RESOURCES',
  'ORGANIZATION',
  'REPORTING',
  'BRAND',
  'GENERAL',
] as const;
export type DocumentDomainCode = (typeof DOCUMENT_DOMAIN_CODES)[number];

export const DOCUMENT_CONFIDENTIALITY_CODES = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
] as const;
export type DocumentConfidentialityCode =
  (typeof DOCUMENT_CONFIDENTIALITY_CODES)[number];

export const DOCUMENT_ARCHIVE_STATUS_CODES = [
  'ACTIVE',
  'ARCHIVED',
  'DELETED',
] as const;
export type DocumentArchiveStatusCode =
  (typeof DOCUMENT_ARCHIVE_STATUS_CODES)[number];

export const DOCUMENT_SCAN_STATUS_CODES = [
  'PENDING_SCAN',
  'CLEAN',
  'INFECTED',
  'SCAN_FAILED',
  'QUARANTINED',
  'AWAITING_ANTIVIRUS_ADAPTER',
] as const;
export type DocumentScanStatusCode =
  (typeof DOCUMENT_SCAN_STATUS_CODES)[number];

export type DocumentValidityFilter =
  'ALL' | 'VALID' | 'EXPIRING' | 'EXPIRED' | 'WITHOUT_EXPIRY';

export type DocumentCompletionFilter = 'COMPLETE' | 'INCOMPLETE';
export type DocumentAttentionFilter = 'INCOMPLETE_OR_EXPIRED';

export const DOCUMENT_PERSONAL_VIEW_CODES = [
  'OWNED',
  'UPLOADED',
  'RECENTLY_VIEWED',
] as const;
export type DocumentPersonalViewCode =
  (typeof DOCUMENT_PERSONAL_VIEW_CODES)[number];

export type DocumentSortCode =
  | 'createdAt'
  | 'updatedAt'
  | 'title'
  | 'archiveCode'
  | 'validUntil'
  | 'sizeBytes';

export interface DocumentListQueryV1 {
  search?: string;
  /** Exact canonical source reference. All three source fields must be supplied together. */
  sourceModule?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  typeCode?: string;
  categoryId?: string;
  branchId?: string;
  domain?: DocumentDomainCode;
  archiveStatus?: DocumentArchiveStatusCode;
  scanStatus?: DocumentScanStatusCode;
  validity?: DocumentValidityFilter;
  completion?: DocumentCompletionFilter;
  attention?: DocumentAttentionFilter;
  ownerUserId?: string;
  confidentiality?: DocumentConfidentialityCode;
  createdFrom?: string;
  createdTo?: string;
  personalView?: DocumentPersonalViewCode;
  sortBy?: DocumentSortCode;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface DocumentTypeOptionV1 {
  id: string;
  code: string;
  name: string;
  domain: DocumentDomainCode;
  defaultConfidentiality: DocumentConfidentialityCode;
  allowedMimeTypes: readonly string[];
  maxFileSizeBytes: number;
  requiresExpiry: boolean;
}

export interface DocumentCategoryOptionV1 {
  id: string;
  code: string;
  name: string;
}

export interface DocumentOwnerOptionV1 {
  id: string;
  displayName: string;
}

export interface DocumentVersionV1 {
  id: string;
  versionNumber: number;
  originalFileName: string;
  safeDownloadName: string;
  detectedMimeType: string;
  extension: string;
  sizeBytes: number;
  sha256Masked: string;
  scanStatus: DocumentScanStatusCode;
  versionNote: string;
  createdBy: DocumentOwnerOptionV1;
  createdAt: string;
}

export interface DocumentRelationV1 {
  id: string;
  relationType: string;
  sourceModule: string;
  sourceEntityType: string;
  sourceEntityIdMasked: string;
  displayLabel: string;
}

export interface DocumentListItemV1 {
  id: string;
  archiveCode: string;
  title: string;
  description: string | null;
  type: Pick<DocumentTypeOptionV1, 'id' | 'code' | 'name' | 'domain'>;
  category: DocumentCategoryOptionV1 | null;
  owner: DocumentOwnerOptionV1;
  branchId: string;
  confidentiality: DocumentConfidentialityCode;
  archiveStatus: DocumentArchiveStatusCode;
  isIncomplete: boolean;
  validUntil: string | null;
  version: number;
  currentVersion: DocumentVersionV1;
  capabilities: DocumentCapabilitiesV1;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCapabilitiesV1 {
  viewFile: boolean;
  download: boolean;
  uploadVersion: boolean;
  editMetadata: boolean;
  viewAudit: boolean;
  archive: boolean;
  restore: boolean;
  markIncomplete: boolean;
  permanentDelete: boolean;
}

export interface DocumentDetailV1 extends DocumentListItemV1 {
  sourceModule: string;
  sourceEntityType: string | null;
  sourceEntityIdMasked: string | null;
  legalHoldActive: boolean;
  versions: readonly DocumentVersionV1[];
  relations: readonly DocumentRelationV1[];
  capabilities: DocumentCapabilitiesV1;
}

export interface DocumentAuditEventV1 {
  id: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE';
  actor: DocumentOwnerOptionV1;
  occurredAt: string;
  reason: string | null;
  ipSummary: string;
  userAgentSummary: string;
}

export interface DocumentListResponseV1 {
  data: readonly DocumentListItemV1[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DocumentOptionsResponseV1 {
  data: {
    currentUserId: string;
    branches: readonly BranchReference[];
    documentTypes: readonly DocumentTypeOptionV1[];
    categories: readonly DocumentCategoryOptionV1[];
    owners: readonly DocumentOwnerOptionV1[];
    uploadPolicy: {
      maxFileSizeBytes: number;
      allowedMimeTypes: readonly string[];
      antivirusAvailable: boolean;
    };
  };
}

export interface DocumentCaseOptionV1 {
  id: string;
  displayLabel: string;
}

export interface DocumentCaseOptionsQueryV1 {
  branchId: string;
  search?: string;
  limit?: number;
}

export interface DocumentCaseOptionsResponseV1 {
  data: readonly DocumentCaseOptionV1[];
  meta: {
    hasMore: boolean;
    limit: number;
  };
}

export interface DocumentDetailResponseV1 {
  data: DocumentDetailV1;
}

export interface DocumentAuditResponseV1 {
  data: readonly DocumentAuditEventV1[];
}

export interface DocumentUpdateInputV1 {
  title: string;
  description?: string;
  categoryId: string;
  ownerUserId: string;
  confidentiality: DocumentConfidentialityCode;
  validUntil?: string;
  isIncomplete: boolean;
  version: number;
}

export type DocumentBulkActionV1 =
  'MARK_INCOMPLETE' | 'MARK_COMPLETE' | 'ARCHIVE' | 'RESTORE';

export interface DocumentBulkActionInputV1 {
  ids: readonly string[];
  action: DocumentBulkActionV1;
  reason: string;
}

export interface DocumentBulkActionResponseV1 {
  data: {
    updatedCount: number;
  };
}

export interface DocumentArchiveActionInputV1 {
  reason: string;
  version: number;
}

export interface DocumentDeleteInputV1 {
  reason: string;
  version: number;
}
