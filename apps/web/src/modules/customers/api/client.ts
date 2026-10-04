import type {
  BranchReference,
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
  CustomerRegistrationLookupRequest,
  CustomerStatusRequest,
  CustomerStatusHistoryResponse,
  DuplicateCandidate,
  DuplicateReviewRequest,
} from '@nora/contracts';

import { getPublicApiBaseUrl } from '../../../lib/environment';
import { refreshAuthenticatedSession } from '../../../lib/auth-session';
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

export function customerErrorMessage(
  envelope: {
    message?: string;
    error?: {
      code?: string;
      message?: string;
      details?: readonly { reason?: string }[];
    };
  } | null,
) {
  if (
    envelope?.error?.code !== 'VALIDATION_ERROR' ||
    envelope.error.message !== 'Request validation failed.'
  )
    return (
      envelope?.error?.message ??
      envelope?.message ??
      'عملیات مشتریان ناموفق بود.'
    );
  const labels: Record<string, string> = {
    firstName: 'نام',
    lastName: 'نام خانوادگی',
    displayName: 'نام کامل',
    nationalId: 'کد ملی',
    birthDate: 'تاریخ تولد',
    passportNumber: 'شماره پاسپورت',
    passportExpiryDate: 'تاریخ انقضای پاسپورت',
    passportFirstName: 'نام انگلیسی پاسپورت',
    passportLastName: 'نام خانوادگی انگلیسی پاسپورت',
    gender: 'جنسیت',
    nationalityCode: 'ملیت',
    passportIssuingCountryCode: 'کشور صادرکننده پاسپورت',
    birthCountryCode: 'کشور محل تولد',
    acquaintanceMethodId: 'روش آشنایی',
    version: 'نسخه پرونده',
    value: 'شماره تماس یا ایمیل',
  };
  const fields = new Set<string>();
  for (const detail of envelope.error.details ?? [])
    for (const [key, label] of Object.entries(labels))
      if (
        typeof detail.reason === 'string' &&
        new RegExp('(?:^|\\.)' + key + '(?:\\s|$)').test(detail.reason)
      )
        fields.add(label);
  return fields.size
    ? [...fields]
        .map((label) => label + ' را کامل و معتبر وارد کنید.')
        .join(' ')
    : 'اطلاعات واردشده معتبر نیست؛ فیلدهای فرم را بررسی کنید.';
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
    (await refreshAuthenticatedSession(baseUrl))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: {
        code?: string;
        message?: string;
        details?: { reason?: string }[];
      };
    } | null;
    throw new CustomersApiError(
      customerErrorMessage(envelope),
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
  registrationLookup(input: CustomerRegistrationLookupRequest) {
    return request<{ data: CustomerDetail | null }>(
      '/registration-lookup',
      body(input),
    );
  },
  async branchReferences(): Promise<readonly BranchReference[]> {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl)
      throw new CustomersApiError('نشانی API پیکربندی نشده است.', 0);
    const session = await refreshAuthenticatedSession(baseUrl);
    if (!session?.user?.branches) {
      throw new CustomersApiError('دریافت نام شعب مجاز ناموفق بود.', 0);
    }
    return session.user.branches;
  },
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
