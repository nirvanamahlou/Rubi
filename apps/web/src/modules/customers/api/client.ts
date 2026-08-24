import type {
  CustomerAddressRequest,
  CustomerCompanionRequest,
  CustomerConsentRequest,
  CustomerContactRequest,
  CustomerDetail,
  CustomerListQuery,
  CustomerListResponse,
  CustomerMutationRequest,
  CustomerStatusRequest,
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new CustomersApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/customers${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
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
  detail(id: string) {
    return request<{ data: CustomerDetail }>(`/${encodeURIComponent(id)}`);
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
