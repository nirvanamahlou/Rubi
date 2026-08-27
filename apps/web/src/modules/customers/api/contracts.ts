import type { CustomerListQuery } from '@rubi/contracts';

export * from '@rubi/contracts';

export function normalizeCustomerListQuery(
  input: Partial<CustomerListQuery>,
): CustomerListQuery {
  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    kind: input.kind ?? 'all',
    status: input.status ?? 'all',
    role: input.role ?? 'all',
    branchId: input.branchId ?? 'all',
    acquaintanceMethodId: input.acquaintanceMethodId ?? 'all',
    createdFrom: input.createdFrom ?? null,
    createdTo: input.createdTo ?? null,
    updatedFrom: input.updatedFrom ?? null,
    updatedTo: input.updatedTo ?? null,
    sortBy: input.sortBy ?? 'updatedAt',
    sortDirection: input.sortDirection ?? 'desc',
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(100, Math.max(10, Math.trunc(input.pageSize ?? 25))),
  };
}

export function serializeCustomerListQuery(query: CustomerListQuery): string {
  return new URLSearchParams({
    search: query.search,
    kind: query.kind ?? 'all',
    status: query.status,
    role: query.role,
    branchId: query.branchId ?? 'all',
    acquaintanceMethodId: query.acquaintanceMethodId ?? 'all',
    ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
    ...(query.createdTo ? { createdTo: query.createdTo } : {}),
    ...(query.updatedFrom ? { updatedFrom: query.updatedFrom } : {}),
    ...(query.updatedTo ? { updatedTo: query.updatedTo } : {}),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    page: String(query.page),
    pageSize: String(query.pageSize),
  }).toString();
}
