import {
  CUSTOMERS_API_PREFIX,
  CUSTOMERS_CONTRACT_VERSION,
  customerEndpoints,
  type CustomerDetail,
  type CustomerListQuery,
  type CustomerListResponse,
} from '@rubi/contracts';

import { getPublicApiBaseUrl } from '../../../lib/environment';

export const CUSTOMER_AFFAIRS_CUSTOMERS_CONTRACT_VERSION =
  CUSTOMERS_CONTRACT_VERSION;

export class CustomerLookupApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

function relativeCustomerPath(publicPath: string): string {
  const prefix = '/api/v1';
  if (!publicPath.startsWith(prefix))
    throw new CustomerLookupApiError('Invalid public Customers path.', 0);
  return publicPath.slice(prefix.length);
}

async function request<T>(
  publicPath: string,
  signal?: AbortSignal,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new CustomerLookupApiError(
      'Public API base URL is not configured.',
      0,
    );
  const response = await fetch(
    `${baseUrl}${relativeCustomerPath(publicPath)}`,
    {
      credentials: 'include',
      headers: { accept: 'application/json' },
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new CustomerLookupApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'Customer lookup request failed.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

function serialize(query: CustomerListQuery): string {
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

export const customerAffairsCustomersApi = {
  search(query: CustomerListQuery, signal?: AbortSignal) {
    return request<CustomerListResponse>(
      `${CUSTOMERS_API_PREFIX}?${serialize(query)}`,
      signal,
    );
  },
  detail(customerId: string, signal?: AbortSignal) {
    return request<{ data: CustomerDetail }>(
      customerEndpoints.detail(customerId),
      signal,
    );
  },
};
