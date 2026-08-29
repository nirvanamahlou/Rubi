export const MASTER_DATA_CONTRACT_VERSION = 7 as const;
export const MASTER_DATA_API_PREFIX = '/api/v1/master-data' as const;

export const MASTER_DATA_RESOURCES = [
  'countries',
  'regions',
  'cities',
  'airports',
  'terminals',
  'currencies',
  'exchange-rates',
  'banks',
  'bank-branches',
  'payment-methods',
  'insurers',
  'airlines',
  'hotels',
  'organizations',
  'suppliers',
  'brokers',
  'travel-services',
  'organization-contacts',
  'leaders',
  'acquaintance-methods',
] as const;

export type MasterDataResource = (typeof MASTER_DATA_RESOURCES)[number];
export type MasterDataStatus = 'active' | 'inactive';
export type MasterRegionType = 'PROVINCE' | 'STATE' | 'REGION' | 'TERRITORY';
export type MasterTerminalType = 'DOMESTIC' | 'INTERNATIONAL' | 'VIP';
export type MasterCurrencyDisplayPolicy =
  'SYMBOL_BEFORE' | 'SYMBOL_AFTER' | 'CODE_BEFORE' | 'CODE_AFTER';
export type MasterPaymentMethodChannel =
  | 'CASH'
  | 'POS'
  | 'BANK_TRANSFER'
  | 'ONLINE_GATEWAY'
  | 'CREDIT'
  | 'WALLET'
  | 'OTHER';
export type MasterPaymentMethodDirection = 'RECEIPT' | 'PAYMENT' | 'BOTH';
export type MasterCollaborationStatus =
  'ACTIVE' | 'UNDER_REVIEW' | 'PURCHASE_SUSPENDED' | 'ENDED';
export type MasterOrganizationContactChannel =
  'PHONE' | 'WHATSAPP' | 'EMAIL' | 'TELEGRAM' | 'OTHER';

export type MasterDataSortField = 'name' | 'code' | 'updatedAt';
export type MasterDataSortDirection = 'asc' | 'desc';

export interface MasterDataListQuery {
  search: string;
  status: 'all' | MasterDataStatus;
  sortBy: MasterDataSortField;
  sortDirection: MasterDataSortDirection;
  page: number;
  pageSize: number;
  countryId?: string;
  regionId?: string;
  cityId?: string;
  airportId?: string;
  bankId?: string;
  terminalType?: MasterTerminalType;
  paymentChannel?: MasterPaymentMethodChannel;
  paymentDirection?: MasterPaymentMethodDirection;
  organizationId?: string;
  serviceId?: string;
  collaborationStatus?: MasterCollaborationStatus;
  providerConnected?: boolean;
  hasWhatsapp?: boolean;
  contactCompleteness?: 'all' | 'complete' | 'incomplete';
}

export interface MasterDataRecord {
  id: string;
  resource: MasterDataResource;
  code: string;
  name: string;
  status: MasterDataStatus;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MasterDataListResponse {
  data: readonly MasterDataRecord[];
  meta: { page: number; pageSize: number; total: number };
}

export interface MasterDataMutationRequest {
  values: Readonly<Record<string, string | number | readonly string[] | null>>;
  version?: number;
}

export interface MasterDataExportRequest {
  resource: MasterDataResource;
  format: 'xlsx' | 'pdf';
  filters: Omit<MasterDataListQuery, 'page' | 'pageSize'>;
  columns: readonly string[];
  locale: 'fa-IR';
  timezone: string;
}

export interface MasterDataExportOperation {
  id: string;
  status: 'AWAITING_DOCUMENTS_WORKER' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  artifactId: string | null;
  createdAt: string;
}

export type MasterCurrencyRateType = 'BUY' | 'SELL' | 'REFERENCE';
export type MasterCurrencyRateWorkflowStatus =
  'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface MasterCurrencyRateDecisionRequest {
  expectedVersion: number;
  reason: string;
}

export interface MasterCurrencyRateRecord {
  id: string;
  fromCurrencyId: string;
  toCurrencyId: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: string;
  rateType: MasterCurrencyRateType;
  source: string;
  observedAt: string;
  validFrom: string;
  validTo: string | null;
  status: MasterCurrencyRateWorkflowStatus;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  version: number;
  isAuthoritative: false;
}

export interface MasterDataAuditRecord {
  id: string;
  actorUserId: string;
  actorBranchId: string;
  action: string;
  resource: string;
  entityId: string | null;
  outcome: 'SUCCESS' | 'FAILURE';
  beforeSnapshot: unknown;
  afterSnapshot: unknown;
  traceId: string | null;
  entityVersion: number | null;
  reason: string | null;
  occurredAt: string;
}

export interface MasterOrganizationContactUnmasked {
  id: string;
  phone: string | null;
  email: string | null;
}

export interface MasterOrganizationSupplierSummary {
  suppliers: {
    total: number;
    activeCollaboration: number;
    contracted: null;
    providerConnected: number;
  };
  brokers: {
    total: number;
    active: number;
    coveredCities: number;
    incomplete: number;
  };
  contacts: {
    total: number;
    active: number;
    whatsapp: number;
    incomplete: number;
  };
  collaboration: Record<MasterCollaborationStatus, number>;
}
export type MasterHotelImportDuplicateBehavior = 'SKIP' | 'UPDATE';

export interface MasterHotelImportIssue {
  rowNumber?: number;
  column?: string;
  code: string;
  message: string;
}

export interface MasterHotelImportPreview {
  sessionId: string;
  previewToken: string;
  previewExpiresAt: string;
  templateVersion: 'HOTEL_IMPORT_V1';
  scope: {
    countryId: string;
    cityId: string;
    country: string;
    city: string;
  };
  mapping: Readonly<Record<string, string>>;
  security: {
    entryCount: number;
    uncompressedBytes: number;
    formulaCount: 0;
    externalLinkCount: 0;
    macroCount: 0;
    malwareScanStatus: 'UNAVAILABLE';
  };
  counts: { rows: number; invalid: number; duplicates: number };
  rows: readonly {
    rowNumber: number;
    code: string;
    englishName: string;
    city: string;
    starRating: number | null;
    mealServiceCode: string | null;
    defaultRoomType: string | null;
    facilityCount: number;
    isActive: boolean;
    duplicate: boolean;
  }[];
  issues: readonly MasterHotelImportIssue[];
  warnings: readonly MasterHotelImportIssue[];
  previewTruncated: boolean;
  atomicCommit: true;
}

export interface MasterHotelImportCommitRequest {
  previewToken: string;
  idempotencyKey: string;
  duplicateBehavior: MasterHotelImportDuplicateBehavior;
  createMissingReferences: boolean;
}

export interface MasterHotelImportCommitResult {
  sessionId: string;
  status: 'COMPLETED';
  counts: {
    rows: number;
    valid: number;
    invalid: number;
    duplicates: number;
    created: number;
    updated: number;
    skipped: number;
  };
  committedAt: string | null;
}

export const masterDataEndpoints = {
  list: (resource: MasterDataResource) =>
    `${MASTER_DATA_API_PREFIX}/${resource}` as const,
  detail: (resource: MasterDataResource, id: string) =>
    `${MASTER_DATA_API_PREFIX}/${resource}/${encodeURIComponent(id)}` as const,
  status: (resource: MasterDataResource, id: string) =>
    `${MASTER_DATA_API_PREFIX}/${resource}/${encodeURIComponent(id)}/status` as const,
  currencyRates: `${MASTER_DATA_API_PREFIX}/currency-rates` as const,
  currentCurrencyRate:
    `${MASTER_DATA_API_PREFIX}/currency-rates/current` as const,
  currencyRateDecision: (id: string, action: 'approve' | 'reject') =>
    `${MASTER_DATA_API_PREFIX}/currency-rates/${encodeURIComponent(id)}/${action}` as const,
  audit: (resource: string, entityId: string) =>
    `${MASTER_DATA_API_PREFIX}/audit/${encodeURIComponent(resource)}/${encodeURIComponent(entityId)}` as const,
  unmaskOrganizationContact: (id: string) =>
    `${MASTER_DATA_API_PREFIX}/organization-contacts/${encodeURIComponent(id)}/unmask` as const,
  organizationSupplierSummary:
    `${MASTER_DATA_API_PREFIX}/organizations-suppliers/summary` as const,
  hotelImportPreview:
    `${MASTER_DATA_API_PREFIX}/hotel-imports/preview` as const,
  hotelImportCommit: (sessionId: string) =>
    `${MASTER_DATA_API_PREFIX}/hotel-imports/${encodeURIComponent(sessionId)}/commit` as const,

  exports: `${MASTER_DATA_API_PREFIX}/exports` as const,
  excelDownload: `${MASTER_DATA_API_PREFIX}/exports/xlsx/download` as const,
  exportStatus: (id: string) =>
    `${MASTER_DATA_API_PREFIX}/exports/${encodeURIComponent(id)}` as const,
};
