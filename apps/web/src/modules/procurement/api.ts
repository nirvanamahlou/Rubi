import type {
  ProcurementBootstrapV1,
  ProcurementDraftV1,
  ProcurementListV1,
  ProcurementRequestV1,
} from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export class ProcurementApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function procurementRequest<T>(
  path: string,
  init?: RequestInit,
  refreshed = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new ProcurementApiError('نشانی سرویس تنظیم نشده است.', 0);
  const response = await fetch(`${base}/procurement${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  }).catch(() => {
    throw new ProcurementApiError(
      'ارتباط برقرار نشد. اطلاعات فرم حفظ شده است؛ دوباره تلاش کنید.',
      0,
    );
  });
  if (
    response.status === 401 &&
    !refreshed &&
    (await refreshAuthenticatedSession(base))
  )
    return procurementRequest(path, init, true);
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string | string[];
      error?: { message?: string };
    } | null;
    const detail =
      data?.error?.message ??
      (Array.isArray(data?.message) ? data.message.join('، ') : data?.message);
    throw new ProcurementApiError(
      response.status === 401
        ? 'نشست پایان یافته است. دوباره وارد شوید؛ فرم را باز نگه دارید.'
        : response.status === 403
          ? 'اجازه انجام این عملیات را ندارید.'
          : response.status === 409
            ? `اطلاعات هم‌زمان تغییر کرده است. ورودی شما حفظ شد؛ نسخه جدید را بررسی کنید. ${detail ?? ''}`
            : (detail ?? 'عملیات انجام نشد؛ دوباره تلاش کنید.'),
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export type Bootstrap = ProcurementBootstrapV1 & {
  requester: {
    id: string;
    userId: string;
    label: string;
    unitId: string | null;
  } | null;
};
export type Supplier = {
  id: string;
  code: string;
  name: string;
  version: number;
  isActive: boolean;
  collaborationStatus: string;
};
export type ProcurementReport = {
  generatedAt: string;
  counts: { status: string; count: number }[];
  performance: {
    orders: number;
    lateOrders: number;
    discrepancyOrders: number;
    completedOrders: number;
    onTimeOrders: number;
    approvalSeconds: string | null;
    supplySeconds: string | null;
  };
  dimension: string;
  groups: ProcurementListV1<{
    label: string | null;
    currencyCode: string;
    cancelled: boolean;
    count: number;
    amount: string;
  }>;
  basis: 'CURRENT_ORDER_VERSION_BY_CURRENCY';
  finance: 'NOT_CONNECTED';
};
export type ProcurementExportJob = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  kind: 'REQUESTS' | 'REPORT' | 'ORDER';
  format: 'XLSX' | 'PDF';
  createdAt: string;
  errorCode: string | null;
  result: {
    documentId: string;
    versionId: string;
    scanStatus: string;
    branding?: unknown;
  } | null;
};
export const procurementApi = {
  exports: (page: number) =>
    procurementRequest<ProcurementListV1<ProcurementExportJob>>(
      `/exports?page=${page}`,
    ),
  exportJob: (id: string) =>
    procurementRequest<ProcurementExportJob>(
      `/exports/${encodeURIComponent(id)}`,
    ),
  createExport: (body: Record<string, unknown>, key: string) =>
    procurementRequest<ProcurementExportJob>('/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body),
    }),
  reports: (dimension: string, page: number) =>
    procurementRequest<ProcurementReport>(
      `/reports?${new URLSearchParams({ dimension, page: String(page) })}`,
    ),
  owners: (branchId: string, search: string, page: number) =>
    procurementRequest<ProcurementListV1<{ id: string; label: string }>>(
      `/owners?${new URLSearchParams({ branchId, search, page: String(page) })}`,
    ),
  requesters: (branchId: string, search: string, page: number) =>
    procurementRequest<
      ProcurementListV1<{ id: string; label: string; unitId: string | null }>
    >(
      `/requesters?${new URLSearchParams({ branchId, search, page: String(page) })}`,
    ),
  bootstrap: () => procurementRequest<Bootstrap>('/bootstrap'),
  list: (query: URLSearchParams) =>
    procurementRequest<ProcurementListV1<ProcurementRequestV1>>(
      `/requests?${query}`,
    ),
  get: (id: string) =>
    procurementRequest<ProcurementRequestV1>(
      `/requests/${encodeURIComponent(id)}`,
    ),
  suppliers: (page: number, search: string) =>
    procurementRequest<ProcurementListV1<Supplier>>(
      `/suppliers?${new URLSearchParams({ page: String(page), search })}`,
    ),
  records: (id: string, kind: string, page: number) =>
    procurementRequest<ProcurementListV1<Record<string, unknown>>>(
      `/requests/${encodeURIComponent(id)}/records?${new URLSearchParams({ kind, page: String(page) })}`,
    ),
  save: (
    draft: ProcurementDraftV1,
    key: string,
    request?: ProcurementRequestV1,
    requesterEmployeeId?: string,
  ) =>
    procurementRequest<ProcurementRequestV1>(
      request ? `/requests/${encodeURIComponent(request.id)}` : '/requests',
      {
        method: request ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(
          request
            ? { expectedVersion: request.version, draft }
            : { draft, requesterEmployeeId },
        ),
      },
    ),
  command: (
    request: ProcurementRequestV1,
    body: Record<string, unknown>,
    key: string,
  ) =>
    procurementRequest<ProcurementRequestV1>(
      `/requests/${encodeURIComponent(request.id)}/commands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ expectedVersion: request.version, ...body }),
      },
    ),
};
/** Retain the exact key when a failed operation is retried without edits. */
export function retryIdentity(
  previous: { payload: string; key: string } | null,
  payload: unknown,
) {
  const serialized = JSON.stringify(payload);
  return previous?.payload === serialized
    ? previous
    : { payload: serialized, key: crypto.randomUUID() };
}
export function commandAttempt(
  previous:
    | (ReturnType<typeof retryIdentity> & { request: ProcurementRequestV1 })
    | null,
  request: ProcurementRequestV1,
  body: Record<string, unknown>,
) {
  const identity = retryIdentity(previous, { id: request.id, body });
  return previous?.key === identity.key
    ? previous
    : {
        ...identity,
        request:
          previous?.request.id === request.id ? previous.request : request,
      };
}
