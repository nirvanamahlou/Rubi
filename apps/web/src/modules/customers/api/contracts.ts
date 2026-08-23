export const CUSTOMER_API_VERSION = 'customers.v1-draft';
export const CUSTOMER_API_PREFIX = '/api/v1/customers';
export const CUSTOMER_PHASE_A_NOTICE =
  'این Contract فقط طراحی فاز A است و هیچ endpoint یا persistence واقعی ندارد.';

export type CustomerStatus = 'active' | 'inactive';
export type ConsentStatus = 'granted' | 'revoked' | 'not-recorded';
export interface CustomerListQuery {
  search: string;
  status: CustomerStatus | 'all';
  consent: ConsentStatus | 'all';
  sortBy: 'displayName' | 'updatedAt';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
export interface CustomerSummary {
  id: string;
  displayName: string;
  maskedContact: string;
  status: CustomerStatus;
  consent: ConsentStatus;
  companionCount: number;
  updatedAt: string;
}
export const customerEndpoints = {
  list: CUSTOMER_API_PREFIX,
  create: CUSTOMER_API_PREFIX,
  detail: (id: string) => `${CUSTOMER_API_PREFIX}/${encodeURIComponent(id)}`,
  duplicates: `${CUSTOMER_API_PREFIX}/duplicate-candidates`,
  reviewDuplicate: (id: string) =>
    `${CUSTOMER_API_PREFIX}/duplicate-candidates/${encodeURIComponent(id)}/review`,
} as const;

export function normalizeCustomerListQuery(
  input: Partial<CustomerListQuery>,
): CustomerListQuery {
  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    status: input.status ?? 'all',
    consent: input.consent ?? 'all',
    sortBy: input.sortBy ?? 'updatedAt',
    sortDirection: input.sortDirection ?? 'desc',
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(100, Math.max(10, Math.trunc(input.pageSize ?? 25))),
  };
}
