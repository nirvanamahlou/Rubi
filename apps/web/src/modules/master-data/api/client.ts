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
  DocumentListResponseV1,
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

async function logoIdempotencyMarker(file: File) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  const opaqueBytes = new Uint8Array(digest).slice(0, 16);
  opaqueBytes[6] = (opaqueBytes[6]! & 0x0f) | 0x50;
  opaqueBytes[8] = (opaqueBytes[8]! & 0x3f) | 0x80;
  const opaqueToken = Array.from(opaqueBytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const uuid = `${opaqueToken.slice(0, 8)}-${opaqueToken.slice(8, 12)}-${opaqueToken.slice(12, 16)}-${opaqueToken.slice(16, 20)}-${opaqueToken.slice(20)}`;
  return `master-data-logo-v1:${uuid}`;
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
    recordId: string;
    title: string;
  }) {
    assertPersistedSourceId(input.recordId);
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
    const maxSize = Math.min(
      options.data.uploadPolicy.maxFileSizeBytes,
      documentType.maxFileSizeBytes,
    );
    if (
      !options.data.uploadPolicy.allowedMimeTypes.includes(input.file.type) ||
      !documentType.allowedMimeTypes.includes(input.file.type)
    )
      throw new MasterDataApiError(
        'نوع فایل لوگو در سیاست اسناد مجاز نیست.',
        400,
      );
    if (input.file.size > maxSize)
      throw new MasterDataApiError('حجم فایل لوگو بیشتر از حد مجاز است.', 413);

    const idempotencyMarker = await logoIdempotencyMarker(input.file);
    const canonical = new URLSearchParams({
      domain: 'BRAND',
      archiveStatus: 'ACTIVE',
      branchId: branch.id,
      sourceModule: 'master-data',
      sourceEntityType: input.resource,
      sourceEntityId: input.recordId,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      page: '1',
      pageSize: '100',
    });
    const existing = await documentsRequest<DocumentListResponseV1>(
      `?${canonical.toString()}`,
    );
    const duplicate = existing.data.find(
      (item) => item.currentVersion.versionNote === idempotencyMarker,
    );
    if (duplicate)
      return {
        id: duplicate.id,
        scanStatus: duplicate.currentVersion.scanStatus,
        reused: true,
      };

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
    form.set('sourceEntityId', input.recordId);
    form.set(
      'sourceDisplayLabel',
      input.title.trim() || `لوگوی ${input.resource}`,
    );
    form.set('versionNote', idempotencyMarker);
    const response = await documentsRequest<DocumentDetailResponseV1>(
      '/upload',
      {
        method: 'POST',
        body: form,
        headers: { 'Idempotency-Key': idempotencyMarker },
      },
    );
    return {
      id: response.data.id,
      scanStatus: response.data.currentVersion.scanStatus,
      reused: false,
    };
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
      const detached = await masterDataApi.update(
        input.resource,
        base.data.id,
        {
          values: { logoFileReference: null },
          version: base.data.version,
        },
      );
      try {
        await masterDataApi.archiveLogo(previousLogo);
        return detached;
      } catch (error) {
        return {
          ...detached,
          warning:
            error instanceof Error
              ? `لوگو از رکورد جدا شد؛ بایگانی فایل نیازمند اقدام مجدد است: ${error.message}`
              : 'لوگو از رکورد جدا شد؛ بایگانی فایل نیازمند اقدام مجدد است.',
        };
      }
    }

    let uploaded: Awaited<ReturnType<typeof masterDataApi.uploadLogo>>;
    try {
      uploaded = await masterDataApi.uploadLogo({
        file: input.logoChange.file,
        resource: input.resource,
        recordId: base.data.id,
        title: input.title,
      });
    } catch (error) {
      return {
        ...base,
        warning:
          error instanceof Error
            ? `رکورد ذخیره شد، اما بدون لوگو باقی ماند: ${error.message}`
            : 'رکورد ذخیره شد، اما بدون لوگو باقی ماند و بارگذاری باید تکرار شود.',
      };
    }

    try {
      const attached = await masterDataApi.update(
        input.resource,
        base.data.id,
        {
          values: { logoFileReference: uploaded.id },
          version: base.data.version,
        },
      );
      if (previousLogo && previousLogo !== uploaded.id) {
        try {
          await masterDataApi.archiveLogo(previousLogo);
        } catch (error) {
          return {
            ...attached,
            warning:
              error instanceof Error
                ? `لوگوی جدید متصل شد؛ بایگانی لوگوی قبلی نیازمند اقدام مجدد است: ${error.message}`
                : 'لوگوی جدید متصل شد؛ بایگانی لوگوی قبلی نیازمند اقدام مجدد است.',
          };
        }
      }
      return attached;
    } catch (error) {
      return {
        ...base,
        warning:
          error instanceof MasterDataApiError && error.status === 409
            ? 'رکورد ذخیره شد، اما اتصال لوگو به‌دلیل تغییر هم‌زمان انجام نشد؛ صفحه را تازه‌سازی و دوباره تلاش کنید.'
            : `رکورد ذخیره شد، اما اتصال لوگو انجام نشد: ${error instanceof Error ? error.message : 'خطای نامشخص'}`,
      };
    }
  },
  async archiveLogo(documentId: string) {
    const detail = await documentsRequest<DocumentDetailResponseV1>(
      `/${encodeURIComponent(documentId)}`,
    );
    return documentsRequest<DocumentDetailResponseV1>(
      `/${encodeURIComponent(documentId)}/archive`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'حذف یا جایگزینی لوگوی مرجع اطلاعات پایه',
          version: detail.data.version,
        }),
      },
    );
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
