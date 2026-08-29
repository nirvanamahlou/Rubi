import type { MasterDataResource } from '../master-data';

export const CUSTOMERS_CONTRACT_VERSION = 2 as const;
export const CUSTOMERS_API_PREFIX = '/api/v1/customers' as const;

export type CustomerKind = 'person' | 'organization';
export type CustomerStatus = 'active' | 'inactive';
export type CustomerRole = 'customer' | 'passenger';
export type CustomerContactType = 'phone' | 'email';
export type CustomerAddressType = 'home' | 'work' | 'billing' | 'other';
export type CustomerConsentStatus = 'granted' | 'revoked';
export type CustomerConsentPurpose = 'marketing';
export type CustomerConsentChannel = 'sms' | 'email' | 'phone' | 'all';
export type CustomerRelationshipType =
  'family' | 'companion' | 'guardian' | 'dependent';
export type DuplicateReviewStatus =
  'pending' | 'confirmed-distinct' | 'merge-proposed';
export type CustomerSortField = 'displayName' | 'updatedAt' | 'createdAt';
export type CustomerSortDirection = 'asc' | 'desc';
export type CustomerActivityType =
  | 'created'
  | 'updated'
  | 'contact'
  | 'address'
  | 'companion'
  | 'consent'
  | 'status'
  | 'duplicate-review'
  | 'sensitive-view';
export const CUSTOMER_STATUS_REASON_CODES = [
  'manual-activation',
  'manual-deactivation',
  'data-correction',
  'duplicate-review',
] as const;
export type CustomerStatusReasonCode =
  (typeof CUSTOMER_STATUS_REASON_CODES)[number];

export const CUSTOMER_ERROR_CODES = [
  'CUSTOMER_NOT_FOUND',
  'INVALID_MASTER_DATA_REFERENCE',
  'CONCURRENT_MODIFICATION',
  'CUSTOMER_SELF_RELATION',
  'CUSTOMER_RELATION_EXISTS',
  'CUSTOMER_NATIONAL_ID_REQUIRED',
  'CUSTOMER_NATIONAL_ID_INVALID',
  'CUSTOMER_NATIONAL_ID_EXISTS',
  'CUSTOMER_NATIONAL_ID_PERSON_ONLY',
  'DUPLICATE_CANDIDATE_NOT_FOUND',
  'MERGE_BLOCKED_BY_OPEN_DECISION',
] as const;
export type CustomerErrorCode = (typeof CUSTOMER_ERROR_CODES)[number];

export interface CustomerListQuery {
  search: string;
  kind?: 'all' | CustomerKind;
  status: 'all' | CustomerStatus;
  role: 'all' | CustomerRole;
  branchId?: 'all' | string;
  acquaintanceMethodId?: 'all' | string;
  createdFrom?: string | null;
  createdTo?: string | null;
  updatedFrom?: string | null;
  updatedTo?: string | null;
  sortBy: CustomerSortField;
  sortDirection: CustomerSortDirection;
  page: number;
  pageSize: number;
}

export interface CustomerContact {
  id: string;
  type: CustomerContactType;
  label: string | null;
  maskedValue: string;
  value?: string | null;
  isPrimary: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

export interface CustomerAddress {
  id: string;
  type: CustomerAddressType;
  label: string;
  cityId: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface CustomerConsent {
  id: string;
  purpose: CustomerConsentPurpose;
  channel: CustomerConsentChannel;
  status: CustomerConsentStatus;
  source: string;
  reason: string;
  occurredAt: string;
  createdAt: string;
}

export interface CustomerCompanion {
  id: string;
  relatedCustomerId: string;
  relatedDisplayName: string;
  relationshipType: CustomerRelationshipType;
  createdAt: string;
}

export interface CustomerSummary {
  id: string;
  kind: CustomerKind;
  organizationId: string | null;
  displayName: string;
  status: CustomerStatus;
  roles: CustomerRole[];
  maskedPrimaryContact: string | null;
  maskedNationalId: string | null;
  currentConsentStatus: CustomerConsentStatus | 'not-recorded';
  companionCount: number;
  ownerBranchId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  birthDateMasked: boolean;
  nationalId?: string | null;
  acquaintanceMethodId: string | null;
  contacts: readonly CustomerContact[];
  addresses: readonly CustomerAddress[];
  consents: readonly CustomerConsent[];
  companions: readonly CustomerCompanion[];
  mergeAvailability: 'blocked-by-open-decision';
}

export interface CustomerListResponse {
  data: readonly CustomerSummary[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    allowedBranchIds?: readonly string[];
    metrics: CustomerListMetrics;
  };
}

export interface CustomerListMetrics {
  totalCustomers: number;
  totalPassengers: number;
  newCustomersLastThreeMonths: number;
  returningCustomerRate: number | null;
  returningCustomerRateStatus: 'available' | 'awaiting-sales-public-contract';
}

export interface CustomerTimelineActor {
  userId: string;
  displayName: string;
}

export interface CustomerStatusHistoryEntry {
  id: string;
  fromStatus: CustomerStatus | 'none';
  toStatus: CustomerStatus;
  reason: string;
  actor: CustomerTimelineActor;
  actorBranchId: string;
  occurredAt: string;
}

export interface CustomerActivityEntry {
  id: string;
  type: CustomerActivityType;
  title: string;
  description: string;
  actor: CustomerTimelineActor;
  actorBranchId: string;
  occurredAt: string;
}

export interface CustomerAuditEntry {
  id: string;
  action: string;
  outcome: 'success' | 'failure';
  reason: string | null;
  actor: CustomerTimelineActor;
  actorBranchId: string;
  traceId: string | null;
  occurredAt: string;
}

export interface CustomerStatusHistoryResponse {
  data: readonly CustomerStatusHistoryEntry[];
}

export interface CustomerActivityResponse {
  data: readonly CustomerActivityEntry[];
}

export interface CustomerAuditResponse {
  data: readonly CustomerAuditEntry[];
}

export interface MasterDataReferenceInput {
  resource: Extract<
    MasterDataResource,
    'organizations' | 'acquaintance-methods' | 'cities'
  >;
  id: string;
}

export interface CustomerMutationRequest {
  kind: CustomerKind;
  organizationId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
  birthDate?: string | null;
  nationalId?: string | null;
  roles: CustomerRole[];
  acquaintanceMethodId?: string | null;
  version?: number;
}

export interface CustomerStatusRequest {
  status: CustomerStatus;
  version: number;
  reason: CustomerStatusReasonCode;
}

export interface CustomerContactRequest {
  type: CustomerContactType;
  label?: string | null;
  value: string;
  isPrimary?: boolean;
  version: number;
}

export interface CustomerAddressRequest {
  type: CustomerAddressType;
  label: string;
  cityId?: string | null;
  isPrimary?: boolean;
  version: number;
}

export interface CustomerCompanionRequest {
  relatedCustomerId: string;
  relationshipType: CustomerRelationshipType;
  version: number;
}

export interface CustomerConsentRequest {
  purpose: CustomerConsentPurpose;
  channel: CustomerConsentChannel;
  status: CustomerConsentStatus;
  source: string;
  reason: string;
  occurredAt?: string;
  version: number;
}

export interface DuplicateCandidateRequest {
  sourceCustomerId: string;
}

export interface DuplicateCandidate {
  id: string;
  sourceCustomerId: string;
  candidateCustomerId: string;
  candidateDisplayName: string;
  score: number;
  reasons: readonly string[];
  reviewStatus: DuplicateReviewStatus;
  reviewReason: string | null;
  version: number;
  reviewedAt: string | null;
  createdAt: string;
}

export interface DuplicateReviewRequest {
  status: Exclude<DuplicateReviewStatus, 'pending'>;
  reason: string;
  version: number;
}

export interface CustomerMergeProposal {
  duplicateCandidateId: string;
  sourceCustomerId: string;
  targetCustomerId: string;
  reason: string;
  status: 'proposed';
}

export interface CustomerMergeResult {
  status: 'blocked-by-open-decision';
  code: 'MERGE_BLOCKED_BY_OPEN_DECISION';
  mergedCustomerId: null;
}

export const customerEndpoints = {
  list: CUSTOMERS_API_PREFIX,
  create: CUSTOMERS_API_PREFIX,
  detail: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}` as const,
  status: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/status` as const,
  contacts: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/contacts` as const,
  addresses: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/addresses` as const,
  companions: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/companions` as const,
  consents: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/consents` as const,
  statusHistory: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/status-history` as const,
  activity: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/activity` as const,
  audit: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/${encodeURIComponent(id)}/audit` as const,
  duplicateCandidates: `${CUSTOMERS_API_PREFIX}/duplicate-candidates` as const,
  duplicateReview: (id: string) =>
    `${CUSTOMERS_API_PREFIX}/duplicate-candidates/${encodeURIComponent(id)}/review` as const,
} as const;
