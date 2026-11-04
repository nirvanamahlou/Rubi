import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { DocumentsApiError } from '@/modules/documents/api/client';
import type {
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
  DocumentDetailResponseV1,
} from '@nora/contracts';
export interface PaymentReceiptEntry {
  id: string;
  paymentReference: string | null;
  dueAt: string;
}
async function request<T>(
  path: string,
  init?: RequestInit,
  binary = false,
  retried = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new DocumentsApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await localizedFetch(`${base}/sales/contracts/${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return request(path, init, binary, true);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new DocumentsApiError(
      data?.error?.message ?? data?.message ?? 'عملیات اسناد ناموفق بود.',
      response.status,
    );
  }
  return (
    binary ? { blob: await response.blob() } : await response.json()
  ) as T;
}
const path = (id: string, paymentId: string) =>
  `${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}/receipts`;
export const paymentReceiptsApi = {
  entries: (id: string) =>
    request<{ data: PaymentReceiptEntry[] }>(
      `${encodeURIComponent(id)}/receipt-payments`,
    ),
  options: (id: string, paymentId: string) =>
    request<DocumentOptionsResponseV1>(`${path(id, paymentId)}/options`),
  list: (id: string, paymentId: string, page = 1) =>
    request<DocumentListResponseV1>(`${path(id, paymentId)}?page=${page}`),
  upload: (id: string, paymentId: string, form: FormData) =>
    request<DocumentDetailResponseV1>(path(id, paymentId), {
      method: 'POST',
      body: form,
    }),
  download: (id: string, paymentId: string, documentId: string) =>
    request<{ blob: Blob }>(
      `${path(id, paymentId)}/${encodeURIComponent(documentId)}/download`,
      undefined,
      true,
    ),
};
