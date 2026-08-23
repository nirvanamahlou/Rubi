import type { IamPermissionCode } from '@rubi/contracts';

export const CUSTOMER_API_VERSION = 'customers.v1-draft' as const;
export const CUSTOMER_API_PREFIX = '/api/v1/customers' as const;
export const customerPermissions = {
  create: 'customers.create',
  merge: 'customers.merge',
  read: 'customers.read',
  sensitiveRead: 'customers.sensitive.read',
  update: 'customers.update',
  manageConsent: 'customers.consent.manage',
} as const satisfies Record<string, IamPermissionCode>;

export type CustomerStatus = 'active' | 'inactive';
export type ConsentStatus = 'granted' | 'revoked' | 'not-recorded';
export interface CustomerListQuery {
  search: string;
  status: CustomerStatus | 'all';
  sortBy: 'displayName' | 'updatedAt';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
export interface CustomerSummaryDto {
  id: string;
  displayName: string;
  status: CustomerStatus;
  maskedPrimaryContact: string | null;
  companionCount: number;
  consentStatus: ConsentStatus;
  updatedAt: string;
}
export interface CustomerDraftDto {
  displayName: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  primaryPhone: string | null;
  email: string | null;
  addressLabel: string | null;
  consentStatus: ConsentStatus;
  companionCustomerIds: readonly string[];
}
export interface DuplicateCandidateDto {
  candidateCustomerId: string;
  score: number;
  reasons: readonly string[];
  reviewStatus: 'pending' | 'confirmed-distinct' | 'merge-proposed';
}
export interface CustomerApplicationPort {
  list(query: CustomerListQuery): Promise<readonly CustomerSummaryDto[]>;
  getById(id: string): Promise<CustomerSummaryDto | null>;
  create(draft: CustomerDraftDto): Promise<CustomerSummaryDto>;
  update(id: string, draft: CustomerDraftDto): Promise<CustomerSummaryDto>;
  findDuplicateCandidates(
    draft: CustomerDraftDto,
  ): Promise<readonly DuplicateCandidateDto[]>;
}

export const customerApiDesign = {
  list: {
    method: 'GET',
    path: CUSTOMER_API_PREFIX,
    permission: customerPermissions.read,
  },
  create: {
    method: 'POST',
    path: CUSTOMER_API_PREFIX,
    permission: customerPermissions.create,
  },
  detail: {
    method: 'GET',
    path: `${CUSTOMER_API_PREFIX}/:customerId`,
    permission: customerPermissions.read,
  },
  update: {
    method: 'PATCH',
    path: `${CUSTOMER_API_PREFIX}/:customerId`,
    permission: customerPermissions.update,
  },
  duplicates: {
    method: 'POST',
    path: `${CUSTOMER_API_PREFIX}/duplicate-candidates`,
    permission: customerPermissions.read,
  },
  reviewDuplicate: {
    method: 'POST',
    path: `${CUSTOMER_API_PREFIX}/duplicate-candidates/:candidateId/review`,
    permission: customerPermissions.merge,
  },
} as const;
