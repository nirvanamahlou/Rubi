import type {
  DocumentDetailResponseV1,
  DocumentListQueryV1,
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export class CustomerDocumentsApiError extends Error {
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
  retriedAfterRefresh = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new CustomerDocumentsApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/documents${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });
  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    (await refreshAuthenticatedSession(baseUrl))
  ) {
    return request<T>(path, init, true);
  }
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new CustomerDocumentsApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'دریافت مدارک مشتری ناموفق بود.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

function serializeQuery(query: DocumentListQueryV1): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== 'ALL') {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export const customerDocumentsApi = {
  listForCustomer(input: { customerId: string; branchId: string }) {
    return request<DocumentListResponseV1>(
      `?${serializeQuery({
        domain: 'CUSTOMER_IDENTITY',
        branchId: input.branchId,
        sourceModule: 'customers',
        sourceEntityType: 'Customer',
        sourceEntityId: input.customerId,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        page: 1,
        pageSize: 100,
      })}`,
    );
  },
  options() {
    return request<DocumentOptionsResponseV1>('/options');
  },
  upload(form: FormData) {
    return request<DocumentDetailResponseV1>('/upload', {
      method: 'POST',
      body: form,
    });
  },
};
