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
  DocumentDetailResponseV1,
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
} from '@nora/contracts';

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
export type MasterDataManifestFileChange = { kind: 'replace'; file: File };

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

export type MasterDataNotificationChangeKind =
  | 'created'
  | 'updated'
  | 'activated'
  | 'deactivated'
  | 'deleted'
  | 'approved'
  | 'rejected';

export interface MasterDataNotification {
  id: string;
  action: string;
  changeKind: MasterDataNotificationChangeKind;
  resource: string;
  entityId: string | null;
  entityVersion: number | null;
  recordLabel: string | null;
  occurredAt: string;
}

export const MASTER_DATA_CHANGED_EVENT = 'nora:master-data-changed';

const UNSAVED_SOURCE_ID = /^(?:draft|temp|preview)(?:-|$)/i;

function assertPersistedSourceId(recordId: string) {
  if (!recordId.trim() || UNSAVED_SOURCE_ID.test(recordId.trim()))
    throw new MasterDataApiError(
      'لوگو فقط پس از ایجاد رکورد و دریافت شناسه پایدار قابل بارگذاری است.',
      400,
    );
}

async function fileIdempotencyMarker(file: File, prefix: string) {
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
  return `${prefix}:${uuid}`;
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
  const payload = (await response.json()) as T;
  const method = (init?.method ?? 'GET').toUpperCase();
  if (typeof window !== 'undefined' && method !== 'GET' && method !== 'HEAD')
    window.dispatchEvent(new Event(MASTER_DATA_CHANGED_EVENT));
  return payload;
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
        'بارگذاری فایل در اسناد ناموفق بود.',
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
  async uploadManifestTemplateFile(input: {
    file: File;
    recordId: string;
    title: string;
  }) {
    assertPersistedSourceId(input.recordId);
    const xlsxMime =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (input.file.type !== xlsxMime || !/\.xlsx$/i.test(input.file.name))
      throw new MasterDataApiError(
        'قالب منیفست باید فایل Excel با پسوند XLSX باشد.',
        400,
      );

    const options =
      await documentsRequest<DocumentOptionsResponseV1>('/options');
    const documentType = options.data.documentTypes.find(
      (item) => item.code === 'MANIFEST',
    );
    const category = options.data.categories.find(
      (item) => item.code === 'TRAVEL_RESERVATIONS',
    );
    const branch = options.data.branches[0];
    const owner =
      options.data.owners.find(
        (item) => item.id === options.data.currentUserId,
      ) ?? options.data.owners[0];
    if (!documentType || !category || !branch || !owner)
      throw new MasterDataApiError(
        'پیش‌نیاز ذخیره قالب منیفست در اسناد کامل نیست.',
        409,
      );
    const maxSize = Math.min(
      options.data.uploadPolicy.maxFileSizeBytes,
      documentType.maxFileSizeBytes,
    );
    if (
      !options.data.uploadPolicy.allowedMimeTypes.includes(xlsxMime) ||
      !documentType.allowedMimeTypes.includes(xlsxMime)
    )
      throw new MasterDataApiError(
        'فایل XLSX در سیاست فعلی اسناد مجاز نیست.',
        400,
      );
    if (input.file.size > maxSize)
      throw new MasterDataApiError(
        'حجم قالب منیفست بیشتر از حد مجاز اسناد است.',
        413,
      );

    const idempotencyMarker = await fileIdempotencyMarker(
      input.file,
      'master-data-manifest-v1',
    );
    const canonical = new URLSearchParams({
      domain: 'TRAVEL',
      archiveStatus: 'ACTIVE',
      branchId: branch.id,
      sourceModule: 'master-data',
      sourceEntityType: 'manifest-templates',
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
    form.set('title', input.title.trim() || 'قالب منیفست');
    form.set('documentTypeId', documentType.id);
    form.set('categoryId', category.id);
    form.set('branchId', branch.id);
    form.set('ownerUserId', owner.id);
    form.set('confidentiality', 'INTERNAL');
    form.set('sourceModule', 'master-data');
    form.set('sourceEntityType', 'manifest-templates');
    form.set('sourceEntityId', input.recordId);
    form.set('sourceDisplayLabel', input.title.trim() || 'قالب منیفست');
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
  async persistManifestTemplate(input: {
    values: Record<string, string>;
    file?: File;
    existing?: MasterDataRecord;
    title: string;
  }): Promise<MasterDataPersistWithLogoResult> {
    if (!input.existing && !input.file)
      throw new MasterDataApiError('انتخاب فایل XLSX الزامی است.', 400);
    const values = { ...input.values };
    delete values.fileReferenceId;
    const base = input.existing
      ? await masterDataApi.update('manifest-templates', input.existing.id, {
          values,
          version: input.existing.version,
        })
      : await masterDataApi.create('manifest-templates', { values });
    if (!input.file) return base;

    let uploaded: Awaited<
      ReturnType<typeof masterDataApi.uploadManifestTemplateFile>
    >;
    try {
      uploaded = await masterDataApi.uploadManifestTemplateFile({
        file: input.file,
        recordId: base.data.id,
        title: input.title,
      });
    } catch (error) {
      if (!input.existing) {
        try {
          await masterDataApi.remove(
            'manifest-templates',
            base.data.id,
            base.data.version,
          );
        } catch {
          throw new MasterDataApiError(
            `بارگذاری فایل انجام نشد و پیش‌نویس ناقص نیازمند حذف دستی است: ${error instanceof Error ? error.message : 'خطای نامشخص'}`,
            error instanceof MasterDataApiError ? error.status : 500,
          );
        }
      }
      throw error;
    }

    try {
      const attached = await masterDataApi.update(
        'manifest-templates',
        base.data.id,
        {
          values: { fileReferenceId: uploaded.id },
          version: base.data.version,
        },
      );
      const previousFile = String(
        input.existing?.attributes.fileReferenceId ?? '',
      ).trim();
      if (previousFile && previousFile !== uploaded.id) {
        try {
          await masterDataApi.archiveManifestTemplateFile(previousFile);
        } catch (error) {
          return {
            ...attached,
            warning: `قالب جدید متصل شد؛ بایگانی نسخه فایل قبلی نیازمند اقدام مجدد است: ${error instanceof Error ? error.message : 'خطای نامشخص'}`,
          };
        }
      }
      if (uploaded.scanStatus !== 'CLEAN')
        return {
          ...attached,
          warning:
            'قالب ذخیره شد و تا پایان اسکن امنیتی اسناد به‌صورت پیش‌نویس باقی می‌ماند.',
        };

      try {
        return await masterDataApi.update('manifest-templates', base.data.id, {
          values: {
            fileReferenceId: uploaded.id,
            publicationStatus: 'ACTIVE',
          },
          version: attached.data.version,
        });
      } catch (error) {
        return {
          ...attached,
          warning:
            'فایل با موفقیت اسکن شد، اما فعال‌سازی قالب نیازمند اقدام مجدد است: ' +
            (error instanceof Error ? error.message : 'خطای نامشخص'),
        };
      }
    } catch (error) {
      try {
        await masterDataApi.archiveManifestTemplateFile(uploaded.id);
      } catch {
        // The attach error remains primary; orphan cleanup is retried by Documents.
      }
      if (!input.existing) {
        try {
          await masterDataApi.remove(
            'manifest-templates',
            base.data.id,
            base.data.version,
          );
        } catch {
          // Preserve the original attach failure and surface the incomplete draft.
        }
      }
      throw new MasterDataApiError(
        `اتصال فایل به قالب انجام نشد: ${error instanceof Error ? error.message : 'خطای نامشخص'}`,
        error instanceof MasterDataApiError ? error.status : 500,
      );
    }
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
  async archiveManifestTemplateFile(documentId: string) {
    const detail = await documentsRequest<DocumentDetailResponseV1>(
      `/${encodeURIComponent(documentId)}`,
    );
    return documentsRequest<DocumentDetailResponseV1>(
      `/${encodeURIComponent(documentId)}/archive`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: 'جایگزینی فایل قالب منیفست اطلاعات پایه',
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
  notifications(limit = 25) {
    return request<{
      data: readonly MasterDataNotification[];
      meta: { limit: number };
    }>(`/audit/notifications?limit=${Math.min(60, Math.max(1, limit))}`);
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
