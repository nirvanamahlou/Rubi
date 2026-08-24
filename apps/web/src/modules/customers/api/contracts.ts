import type { CustomerListQuery } from '@rubi/contracts';

export * from '@rubi/contracts';

export function normalizeCustomerListQuery(
  input: Partial<CustomerListQuery>,
): CustomerListQuery {
  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    status: input.status ?? 'all',
    role: input.role ?? 'all',
    sortBy: input.sortBy ?? 'updatedAt',
    sortDirection: input.sortDirection ?? 'desc',
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(100, Math.max(10, Math.trunc(input.pageSize ?? 25))),
  };
}

export function serializeCustomerListQuery(query: CustomerListQuery): string {
  return new URLSearchParams({
    search: query.search,
    status: query.status,
    role: query.role,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    page: String(query.page),
    pageSize: String(query.pageSize),
  }).toString();
}
