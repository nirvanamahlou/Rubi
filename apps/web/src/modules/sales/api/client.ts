'use client';
import { browserRandomUuid } from '@/lib/browser-random-uuid';
import { localizedFetch } from '@/i18n/localized-fetch';

import type {
  CustomerMutationRequest,
  CustomerDetail,
  HotelRoomRateV1,
  CustomerSummary,
  SalesBuyerContactV1,
  MasterDataListQuery,
  MasterDataListResponse,
  MasterDataRecord,
  MasterDataResource,
  PackagePublishedSaleV1,
  SalesContractCreateRequest,
  SalesContractAmendmentV1,
  SalesContractPartyCorrectionV1,
  SalesContractProfitV1,
  SalesContractOutputV1,
  SalesContractDetail,
  SalesContractListQuery,
  SalesContractPage,
  SalesDashboard,
  SalesReceivables,
  SalesReceivablesQuery,
  SalesPaymentCreateRequest,
  SalesPaymentAccountV1,
  SalesPassengerIdentityV1,
  SalesPassengerCorrectionHistoryV1,
  SalesPassengerCorrectionCommandV1,
  SalesPassengerCompletionFormV1,
  SalesPassengerCompletionCommandV1,
} from '@nora/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export class SalesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retried = false,
  asBlob = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new SalesApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await localizedFetch(`${baseUrl}/sales${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  }).catch(() => {
    throw new SalesApiError(
      'ارتباط با سرور برقرار نشد؛ اتصال را بررسی و دوباره تلاش کنید.',
      0,
      'NETWORK_ERROR',
    );
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return request<T>(path, init, true, asBlob);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new SalesApiError(
      response.status === 401
        ? 'نشست شما پایان یافته است؛ دوباره وارد حساب شوید.'
        : (payload?.error?.message ??
            payload?.message ??
            'عملیات فروش ناموفق بود.'),
      response.status,
      payload?.error?.code ?? payload?.code,
    );
  }
  if (asBlob) {
    if (
      !response.headers
        .get('content-type')
        ?.includes(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
    )
      throw new SalesApiError(
        'فایل Excel معتبر دریافت نشد؛ دوباره تلاش کنید.',
        response.status,
      );
    return response.blob() as Promise<T>;
  }
  return response.json() as Promise<T>;
}

function queryString(query: SalesContractListQuery): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') parameters.set(key, String(value));
  return parameters.toString();
}

export const salesApi = {
  agencyBuyerContact: (organizationId: string) =>
    request<{ data: SalesBuyerContactV1 }>(
      `/agency-customers/${encodeURIComponent(organizationId)}/contact`,
    ),
  resolveAgencyCustomer: (organizationId: string) =>
    request<{ data: CustomerSummary }>(
      `/agency-customers/${encodeURIComponent(organizationId)}`,
      { method: 'POST' },
    ),
  listReferences: (
    resource: MasterDataResource,
    query: MasterDataListQuery,
  ) => {
    const parameters = new URLSearchParams();
    for (const key of ['search', 'page', 'pageSize'] as const) {
      if (query[key] !== undefined) parameters.set(key, String(query[key]));
    }
    return request<MasterDataListResponse>(
      `/form-references/${encodeURIComponent(resource)}?${parameters}`,
    );
  },
  reference: (resource: MasterDataResource, id: string) =>
    request<{ data: MasterDataRecord }>(
      `/form-references/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
    ),
  priceCorrection: (id: string) =>
    request<{
      version: number;
      totals: { currencyCode: string; amount: string }[];
    }>(`/contracts/${id}/price-correction`),
  correctPrice: (
    id: string,
    input: {
      expectedVersion: number;
      totals: { currencyCode: string; amount: string }[];
      reason: string;
    },
  ) =>
    request<{
      version: number;
      totals: { currencyCode: string; amount: string }[];
    }>(`/contracts/${id}/price-correction`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  passengerCorrectionForm: (id: string) =>
    request<{
      version: number;
      contractNumber: string;
      passengers: SalesPassengerIdentityV1[];
    }>(`/contracts/${encodeURIComponent(id)}/passenger-corrections/form`),
  createCompletionPerson: (id: string, input: CustomerMutationRequest) =>
    request<{ data: CustomerDetail }>(
      `/contracts/${encodeURIComponent(id)}/passenger-completion/people`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  passengerCompletionForm: (id: string) =>
    request<SalesPassengerCompletionFormV1>(
      `/contracts/${encodeURIComponent(id)}/passenger-completion`,
    ),
  completePassengers: (id: string, input: SalesPassengerCompletionCommandV1) =>
    request<{ version: number }>(
      `/contracts/${encodeURIComponent(id)}/passenger-completion`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  passengerCorrectionHistory: (id: string, cursor?: string, eventId?: string) =>
    request<{
      items: SalesPassengerCorrectionHistoryV1[];
      nextCursor: string | null;
    }>(
      `/contracts/${encodeURIComponent(id)}/passenger-corrections?${new URLSearchParams({ ...(cursor ? { cursor } : {}), ...(eventId ? { eventId } : {}) })}`,
    ),
  correctPassengers: (id: string, input: SalesPassengerCorrectionCommandV1) =>
    request<{ version: number; id: string }>(
      `/contracts/${encodeURIComponent(id)}/passenger-corrections`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  amend: (id: string, input: SalesContractAmendmentV1) =>
    request<{ data: SalesContractDetail }>(`/contracts/${id}/amend`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  correctParty: (id: string, input: SalesContractPartyCorrectionV1) =>
    request<{ data: { version: number } }>(
      `/contracts/${encodeURIComponent(id)}/party`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  profit: (id: string) =>
    request<{ data: SalesContractProfitV1 }>(
      `/contracts/${encodeURIComponent(id)}/profit`,
    ),
  cancel: (id: string, version: number, reason: string) =>
    request<{ data: SalesContractDetail }>(
      `/contracts/${encodeURIComponent(id)}/cancel`,
      { method: 'POST', body: JSON.stringify({ version, reason }) },
    ),
  exportXlsx: (query: SalesContractListQuery) => {
    // Export the applied list filters, never just the visible page or unsubmitted input.
    const filters: SalesContractListQuery = {
      ...(query.search ? { search: query.search } : {}),
      ...(query.settlementStatus
        ? { settlementStatus: query.settlementStatus }
        : {}),
      ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
      ...(query.createdTo ? { createdTo: query.createdTo } : {}),
      ...(query.originId ? { originId: query.originId } : {}),
      ...(query.destinationId ? { destinationId: query.destinationId } : {}),
      ...(query.customerType ? { customerType: query.customerType } : {}),
      ...(query.agencyCustomerId
        ? { agencyCustomerId: query.agencyCustomerId }
        : {}),
      ...(query.travelFrom ? { travelFrom: query.travelFrom } : {}),
      ...(query.travelTo ? { travelTo: query.travelTo } : {}),
      sortBy: query.sortBy ?? 'updatedAt',
      sortDirection: query.sortDirection ?? 'desc',
    };
    return request<Blob>(
      `/contracts/export.xlsx?${queryString(filters)}`,
      undefined,
      false,
      true,
    );
  },
  output: (id: string) =>
    request<{ data: SalesContractOutputV1 }>(
      `/contracts/${encodeURIComponent(id)}/output`,
    ),
  dashboard: () => request<SalesDashboard>('/dashboard'),
  receivables: (query: SalesReceivablesQuery = {}) =>
    request<SalesReceivables>(
      `/receivables?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')).toString()}`,
    ),
  publishedPackageSales: (tourDepartureId: string) =>
    request<{ data: PackagePublishedSaleV1[] }>(
      `/pricing/tour-drafts/sale-catalog?${new URLSearchParams({ tourDepartureId })}`,
    ),
  availableHotelRoomRates: (input: {
    hotelId: string;
    checkIn: string;
    checkOut: string;
  }) => {
    const query = new URLSearchParams(input).toString();
    return request<{ data: readonly HotelRoomRateV1[] }>(
      `/hotel-room-rates?${query}`,
    );
  },
  paymentAccounts: (id: string) =>
    request<{ data: SalesPaymentAccountV1[] }>(
      `/contracts/${id}/payment-accounts`,
    ),
  addPayment: (id: string, input: SalesPaymentCreateRequest, key: string) =>
    request<{ data: SalesContractDetail }>(
      `/contracts/${encodeURIComponent(id)}/payments`,
      {
        method: 'POST',
        headers: { 'idempotency-key': key },
        body: JSON.stringify(input),
      },
    ),
  list: (query: SalesContractListQuery) =>
    request<SalesContractPage>(`/contracts?${queryString(query)}`),
  detail: (id: string) =>
    request<{ data: SalesContractDetail }>(
      `/contracts/${encodeURIComponent(id)}`,
    ),
  confirm: (id: string, version: number) =>
    request<{ data: SalesContractDetail }>(
      `/contracts/${encodeURIComponent(id)}/confirm`,
      {
        method: 'POST',
        headers: { 'idempotency-key': `confirm-${id}-${version}` },
        body: JSON.stringify({ version }),
      },
    ),
  async create(
    input: SalesContractCreateRequest,
    idempotencyKey: string = browserRandomUuid(),
  ) {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl) throw new SalesApiError('نشانی API پیکربندی نشده است.', 0);
    const session = await refreshAuthenticatedSession(baseUrl);
    const branchId = session?.user?.branches?.[0]?.id;
    if (!branchId)
      throw new SalesApiError('شعبه فعال برای ثبت قرارداد یافت نشد.', 403);
    return request<{
      data: SalesContractDetail;
      meta: { idempotentReplay: boolean };
    }>('/contracts', {
      method: 'POST',
      headers: {
        'x-branch-id': branchId,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  },
};
