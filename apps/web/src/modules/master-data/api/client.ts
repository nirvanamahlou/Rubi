import type {
  MasterDataExportOperation,
  MasterDataExportRequest,
  MasterHotelImportCommitRequest,
  MasterHotelImportCommitResult,
  MasterHotelImportPreview,
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

async function requestFile(
  path: string,
  input: MasterDataExportRequest,
): Promise<{ blob: Blob; fileName: string }> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new MasterDataApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/master-data${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      message?: string;
    } | null;
    throw new MasterDataApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'دریافت خروجی Excel ناموفق بود.',
      response.status,
    );
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName =
    /filename="?([^";]+)"?/i.exec(disposition)?.[1] ??
    `master-data-${input.resource}.xlsx`;
  return { blob: await response.blob(), fileName };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new MasterDataApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/master-data${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
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
    search?: string;
    fromCurrencyId?: string;
    toCurrencyId?: string;
    rateType?: 'BUY' | 'SELL' | 'REFERENCE';
    status?: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    observedFrom?: string;
    observedTo?: string;
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
  downloadExcel(input: MasterDataExportRequest) {
    return requestFile('/exports/xlsx/download', input);
  },
  export(input: MasterDataExportRequest) {
    return request<{ data: MasterDataExportOperation }>('/exports', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  previewHotelImport(input: { file: File; countryId: string; cityId: string }) {
    const body = new FormData();
    body.set('file', input.file);
    body.set('countryId', input.countryId);
    body.set('cityId', input.cityId);
    body.set('templateVersion', 'HOTEL_IMPORT_V1');
    return request<{ data: MasterHotelImportPreview }>(
      '/hotel-imports/preview',
      { method: 'POST', body },
    );
  },
  commitHotelImport(sessionId: string, input: MasterHotelImportCommitRequest) {
    return request<{ data: MasterHotelImportCommitResult }>(
      `/hotel-imports/${encodeURIComponent(sessionId)}/commit`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
  },
};
