import type {
  MasterDataExportOperation,
  MasterDataExportRequest,
  MasterDataListQuery,
  MasterDataListResponse,
  MasterDataMutationRequest,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@rubi/contracts';

import { getPublicApiBaseUrl } from '../../../lib/environment';
import { serializeMasterDataListQuery } from './contracts';

export class MasterDataApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new MasterDataApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/master-data${path}`, {
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
      error?: { message?: string };
      message?: string;
    } | null;
    throw new MasterDataApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'عملیات اطلاعات پایه ناموفق بود.',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export const masterDataApi = {
  list(resource: MasterDataResource, query: MasterDataListQuery) {
    return request<MasterDataListResponse>(
      `/${resource}?${serializeMasterDataListQuery(query)}`,
    );
  },
  detail(resource: MasterDataResource, id: string) {
    return request<{ data: MasterDataRecord }>(
      `/${resource}/${encodeURIComponent(id)}`,
    );
  },
  create(resource: MasterDataResource, body: MasterDataMutationRequest) {
    return request<{ data: MasterDataRecord }>(`/${resource}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  update(
    resource: MasterDataResource,
    id: string,
    body: MasterDataMutationRequest,
  ) {
    return request<{ data: MasterDataRecord }>(
      `/${resource}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
  },
  setStatus(
    resource: MasterDataResource,
    id: string,
    status: MasterDataStatus,
    version: number,
  ) {
    return request<{ data: MasterDataRecord }>(
      `/${resource}/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: JSON.stringify({ status, version }) },
    );
  },
  currencyRateHistory(query: {
    fromCurrencyId?: string;
    toCurrencyId?: string;
    rateType?: 'BUY' | 'SELL' | 'REFERENCE';
    status?: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    page?: number;
    pageSize?: number;
  }) {
    const parameters = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) parameters.set(key, String(value));
    }
    return request<{
      data: readonly Record<string, unknown>[];
      meta: { total: number };
    }>(`/currency-rates?${parameters.toString()}`);
  },
  decideCurrencyRate(
    id: string,
    action: 'approve' | 'reject',
    expectedVersion: number,
    reason: string,
  ) {
    return request<{ data: Record<string, unknown> }>(
      `/currency-rates/${encodeURIComponent(id)}/${action}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion, reason }),
      },
    );
  },
  audit(resource: MasterDataResource, entityId: string, page = 1) {
    return request<{
      data: readonly Record<string, unknown>[];
      meta: { total: number };
    }>(`/audit/${resource}/${encodeURIComponent(entityId)}?page=${page}`);
  },
  export(input: MasterDataExportRequest) {
    return request<{ data: MasterDataExportOperation }>('/exports', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
