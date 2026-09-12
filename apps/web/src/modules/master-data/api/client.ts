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
  MasterOrganizationAddressMutationV1,
  MasterOrganizationAddressV1,
  MasterOrganizationSupplierSummary,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterDataDeleteResponse,
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

export type MasterDataLogoChange =
  { kind: 'replace'; file: File } | { kind: 'remove' };

export interface MasterDataPersistWithLogoInput {
  resource: MasterDataResource;
  values: Record<string, string>;
  existing?: MasterDataRecord;
  logoChange?: MasterDataLogoChange;
  title: string;
}

export interface MasterDataPersistWithLogoResult {
  data: MasterDataRecord;
  warning?: string;
}

const UNSAVED_SOURCE_ID = /^(?:draft|temp|preview)(?:-|$)/i;

function assertPersistedSourceId(recordId: string) {
  if (!recordId.trim() || UNSAVED_SOURCE_ID.test(recordId.trim()))
    throw new MasterDataApiError(
      'لوگو فقط پس از ایجاد رکورد و دریافت شناسه پایدار قابل بارگذاری است.',
      400,
    );
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
  async uploadLogo(input: {
    file: File;
    resource: MasterDataResource;
    recordId: string;
    title: string;
    version: number;
  }) {
    assertPersistedSourceId(input.recordId);
    if (!['image/png', 'image/jpeg'].includes(input.file.type))
      throw new MasterDataApiError('لوگو باید PNG یا JPEG باشد.', 400);
    if (input.file.size < 1 || input.file.size > 5 * 1024 * 1024)
      throw new MasterDataApiError('حجم فایل لوگو بیشتر از حد مجاز است.', 413);

    const form = new FormData();
    form.set('file', input.file);
    form.set('title', input.title.trim() || `لوگوی ${input.resource}`);
    form.set('version', String(input.version));
    return request<MasterDataPersistWithLogoResult>(
      `/${input.resource}/${encodeURIComponent(input.recordId)}/logo`,
      { method: 'POST', body: form },
    );
  },
  removeLogo(input: {
    resource: MasterDataResource;
    recordId: string;
    version: number;
  }) {
    assertPersistedSourceId(input.recordId);
    return request<MasterDataPersistWithLogoResult>(
      `/${input.resource}/${encodeURIComponent(input.recordId)}/logo`,
      { method: 'DELETE', body: JSON.stringify({ version: input.version }) },
    );
  },
  async persistWithLogo(
    input: MasterDataPersistWithLogoInput,
  ): Promise<MasterDataPersistWithLogoResult> {
    const baseValues = { ...input.values };
    delete baseValues.logoFileReference;
    const base = input.existing
      ? await masterDataApi.update(input.resource, input.existing.id, {
          values: baseValues,
          version: input.existing.version,
        })
      : await masterDataApi.create(input.resource, { values: baseValues });
    if (!input.logoChange) return base;

    const previousLogo = String(
      input.existing?.attributes.logoFileReference ?? '',
    ).trim();
    if (input.logoChange.kind === 'remove') {
      if (!previousLogo) return base;
      return masterDataApi.removeLogo({
        resource: input.resource,
        recordId: base.data.id,
        version: base.data.version,
      });
    }

    try {
      return await masterDataApi.uploadLogo({
        file: input.logoChange.file,
        resource: input.resource,
        recordId: base.data.id,
        title: input.title,
        version: base.data.version,
      });
    } catch (error) {
      return {
        ...base,
        warning:
          error instanceof MasterDataApiError && error.status === 409
            ? 'رکورد ذخیره شد، اما اتصال لوگو به‌دلیل تغییر هم‌زمان انجام نشد؛ صفحه را تازه‌سازی و دوباره تلاش کنید.'
            : error instanceof Error
              ? `رکورد ذخیره شد، اما بدون لوگو باقی ماند: ${error.message}`
              : 'رکورد ذخیره شد، اما بدون لوگو باقی ماند و بارگذاری باید تکرار شود.',
      };
    }
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
  organizationAddresses(organizationId: string) {
    return request<{ data: readonly MasterOrganizationAddressV1[] }>(
      `/organizations/${encodeURIComponent(organizationId)}/addresses`,
    );
  },
  deleteOrganizationAddress(
    organizationId: string,
    addressId: string,
    version: number,
  ) {
    return request<{ data: { id: string; deleted: boolean } }>(
      `/organizations/${encodeURIComponent(organizationId)}/addresses/${encodeURIComponent(addressId)}`,
      { method: 'DELETE', body: JSON.stringify({ version }) },
    );
  },
  createOrganizationAddress(
    organizationId: string,
    input: MasterOrganizationAddressMutationV1,
  ) {
    return request<{ data: MasterOrganizationAddressV1 }>(
      `/organizations/${encodeURIComponent(organizationId)}/addresses`,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },
  updateOrganizationAddress(
    organizationId: string,
    addressId: string,
    input: MasterOrganizationAddressMutationV1,
  ) {
    return request<{ data: MasterOrganizationAddressV1 }>(
      `/organizations/${encodeURIComponent(organizationId)}/addresses/${encodeURIComponent(addressId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
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
