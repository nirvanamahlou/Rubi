import type {
  CustomerAddressRequest,
  CustomerActivityResponse,
  CustomerAuditResponse,
  CustomerCompanionRequest,
  CustomerConsentRequest,
  CustomerContactRequest,
  CustomerDetail,
  CustomerListQuery,
  CustomerListResponse,
  CustomerMutationRequest,
  CustomerStatusRequest,
  CustomerStatusHistoryResponse,
  DuplicateCandidate,
  DuplicateReviewRequest,
} from '@rubi/contracts';

import { getPublicApiBaseUrl } from '../../../lib/environment';
import { serializeCustomerListQuery } from './contracts';

export class CustomersApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccess(baseUrl: string) {
  refreshInFlight ??= fetch(`${baseUrl}/iam/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retriedAfterRefresh = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new CustomersApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/customers${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    (await refreshAccess(baseUrl))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new CustomersApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'عملیات مشتریان ناموفق بود.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

const body = (value: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(value),
});

export const customersApi = {
  list(query: CustomerListQuery) {
    return request<CustomerListResponse>(
      `?${serializeCustomerListQuery(query)}`,
    );
  },
  detail(id: string, sensitiveReadReason?: string) {
    return request<{ data: CustomerDetail }>(
      `/${encodeURIComponent(id)}`,
      sensitiveReadReason
        ? { headers: { 'x-sensitive-read-reason': sensitiveReadReason } }
        : undefined,
    );
  },
  statusHistory(id: string) {
    return request<CustomerStatusHistoryResponse>(
      `/${encodeURIComponent(id)}/status-history`,
    );
  },
  activity(id: string) {
    return request<CustomerActivityResponse>(
      `/${encodeURIComponent(id)}/activity`,
    );
  },
  audit(id: string) {
    return request<CustomerAuditResponse>(`/${encodeURIComponent(id)}/audit`);
  },
  create(input: CustomerMutationRequest) {
    return request<{ data: CustomerDetail }>('', body(input));
  },
  update(id: string, input: CustomerMutationRequest) {
    return request<{ data: CustomerDetail }>(`/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  status(id: string, input: CustomerStatusRequest) {
    return request<{ data: CustomerDetail }>(
      `/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
  },
  addContact(id: string, input: CustomerContactRequest) {
    return request<{ data: CustomerDetail }>(
      `/${encodeURIComponent(id)}/contacts`,
      body(input),
    );
  },
  addAddress(id: string, input: CustomerAddressRequest) {
    return request<{ data: CustomerDetail }>(
      `/${encodeURIComponent(id)}/addresses`,
      body(input),
    );
  },
  addCompanion(id: string, input: CustomerCompanionRequest) {
    return request<{ data: CustomerDetail }>(
      `/${encodeURIComponent(id)}/companions`,
      body(input),
    );
  },
  addConsent(id: string, input: CustomerConsentRequest) {
    return request<{ data: CustomerDetail }>(
      `/${encodeURIComponent(id)}/consents`,
      body(input),
    );
  },
  detectDuplicates(sourceCustomerId: string) {
    return request<{
      data: readonly DuplicateCandidate[];
      meta: { autoMergePerformed: false };
    }>('/duplicate-candidates', body({ sourceCustomerId }));
  },
  reviewDuplicate(id: string, input: DuplicateReviewRequest) {
    return request<{
      data: DuplicateCandidate;
      mergeResult: { status: string } | null;
    }>(`/duplicate-candidates/${encodeURIComponent(id)}/review`, body(input));
  },
};
