import type {
  MasterCurrencyRateQuoteRequest,
  MasterCurrencyRateRecord,
  MasterAccommodationSummary,
  MasterInsuranceSummary,
  MasterTravelServicesSummary,
  MasterDataExportOperation,
  MasterDataExportRequest,
  MasterHotelImportCommitRequest,
  MasterHotelImportCommitResult,
  MasterHotelImportPreview,
  MasterDataListQuery,
  MasterDataListResponse,
  MasterDataMutationRequest,
  MasterOrganizationContactUnmasked,
  MasterOrganizationSupplierSummary,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterDataDeleteResponse,
  DocumentDetailResponseV1,
  DocumentOptionsResponseV1,
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

async function documentsRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new MasterDataApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/documents${path}`, {
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
        'بارگذاری لوگو ناموفق بود.',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export const masterDataApi = {
  async uploadLogo(input: {
    file: File;
    resource: MasterDataResource;
    recordId?: string;
    title: string;
  }) {
    if (!['image/png', 'image/jpeg'].includes(input.file.type))
      throw new MasterDataApiError('لوگو باید PNG یا JPEG باشد.', 400);
    const options =
      await documentsRequest<DocumentOptionsResponseV1>('/options');
    const documentType = options.data.documentTypes.find(
      (item) => item.code === 'BRAND_ASSET_TEMPLATE',
    );
    const category =
      options.data.categories.find((item) => item.code === 'BRAND_ASSETS') ??
      options.data.categories[0];
    const branch = options.data.branches[0];
    const owner =
      options.data.owners.find(
        (item) => item.id === options.data.currentUserId,
      ) ?? options.data.owners[0];
    if (!documentType || !category || !branch || !owner)
      throw new MasterDataApiError(
        'پیش‌نیاز بارگذاری لوگو در اسناد کامل نیست.',
        409,
      );
    const form = new FormData();
    form.set('file', input.file);
    form.set('title', input.title.trim() || `لوگوی ${input.resource}`);
    form.set('documentTypeId', documentType.id);
    form.set('categoryId', category.id);
    form.set('branchId', branch.id);
    form.set('ownerUserId', owner.id);
    form.set('confidentiality', 'INTERNAL');
    form.set('sourceModule', 'master-data');
    form.set('sourceEntityType', input.resource);
    form.set(
      'sourceEntityId',
      input.recordId ?? `draft-${crypto.randomUUID()}`,
    );
    form.set(
      'sourceDisplayLabel',
      input.title.trim() || `لوگوی ${input.resource}`,
    );
    const response = await documentsRequest<DocumentDetailResponseV1>(
      '/upload',
      {
        method: 'POST',
        body: form,
      },
    );
    return {
      id: response.data.id,
      scanStatus: response.data.currentVersion.scanStatus,
    };
  },
  list(resource: MasterDataResource, query: MasterDataListQuery) {
    return request<MasterDataListResponse>(
      `/${resource}?${serializeMasterDataListQuery(query)}`,
    );
  },
  listSummary(
    resource: MasterDataResource,
    query: Omit<MasterDataListQuery, 'page' | 'pageSize'>,
  ) {
    // KPI totals still use the list endpoint and must obey its 10–100 limit.
    return masterDataApi.list(resource, { ...query, page: 1, pageSize: 10 });
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
  remove(resource: MasterDataResource, id: string, version: number) {
    return request<MasterDataDeleteResponse>(
      `/${resource}/${encodeURIComponent(id)}`,
      { method: 'DELETE', body: JSON.stringify({ version }) },
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
    columnFilter1?: string;
    columnFilter2?: string;
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
  createCurrencyQuote(input: MasterCurrencyRateQuoteRequest) {
    return request<{ data: readonly MasterCurrencyRateRecord[] }>(
      '/currency-rates/quotes',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
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
  unmaskOrganizationContact(id: string) {
    return request<{ data: MasterOrganizationContactUnmasked }>(
      `/organization-contacts/${encodeURIComponent(id)}/unmask`,
    );
  },
  organizationSupplierSummary() {
    return request<{ data: MasterOrganizationSupplierSummary }>(
      '/organizations-suppliers/summary',
    );
  },
  accommodationSummary() {
    return request<{ data: MasterAccommodationSummary }>(
      '/accommodation/summary',
    );
  },
  insuranceSummary() {
    return request<{ data: MasterInsuranceSummary }>('/insurance/summary');
  },
  travelServicesSummary() {
    return request<{ data: MasterTravelServicesSummary }>(
      '/travel-services-catalog/summary',
    );
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
