import type {
  DocumentAuditResponseV1,
  DocumentDetailResponseV1,
  DocumentListQueryV1,
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';

import { getPublicApiBaseUrl } from '../../../lib/environment';
import { refreshAuthenticatedSession } from '../../../lib/auth-session';

export class DocumentsApiError extends Error {
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
  if (!baseUrl) throw new DocumentsApiError('نشانی API پیکربندی نشده است.', 0);
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
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new DocumentsApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'عملیات اسناد ناموفق بود.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

async function requestFile(
  path: string,
  sensitiveReason?: string,
  signal?: AbortSignal,
  retriedAfterRefresh = false,
): Promise<{ blob: Blob; disposition: string | null }> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new DocumentsApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/documents${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...(signal ? { signal } : {}),
    headers: {
      accept: '*/*',
      ...(sensitiveReason
        ? {
            'x-sensitive-read-reason': encodeURIComponent(sensitiveReason),
          }
        : {}),
    },
  });
  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    (await refreshAuthenticatedSession(baseUrl))
  ) {
    return requestFile(path, sensitiveReason, signal, true);
  }
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new DocumentsApiError(
      envelope?.error?.message ?? envelope?.message ?? 'دریافت فایل مجاز نیست.',
      response.status,
    );
  }
  return {
    blob: await response.blob(),
    disposition: response.headers.get('content-disposition'),
  };
}

function serializeListQuery(query: DocumentListQueryV1): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '' && value !== 'ALL') {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export const documentsApi = {
  list(query: DocumentListQueryV1) {
    return request<DocumentListResponseV1>(`?${serializeListQuery(query)}`);
  },
  options() {
    return request<DocumentOptionsResponseV1>('/options');
  },
  detail(id: string, sensitiveReason?: string) {
    return request<DocumentDetailResponseV1>(
      `/${encodeURIComponent(id)}`,
      sensitiveReason
        ? {
            headers: {
              'x-sensitive-read-reason': encodeURIComponent(sensitiveReason),
            },
          }
        : undefined,
    );
  },
  audit(id: string) {
    return request<DocumentAuditResponseV1>(`/${encodeURIComponent(id)}/audit`);
  },
  upload(form: FormData) {
    return request<DocumentDetailResponseV1>('/upload', {
      method: 'POST',
      body: form,
    });
  },
  download(id: string, sensitiveReason?: string) {
    return requestFile(`/${encodeURIComponent(id)}/download`, sensitiveReason);
  },
  preview(id: string, sensitiveReason?: string, signal?: AbortSignal) {
    return requestFile(
      `/${encodeURIComponent(id)}/preview`,
      sensitiveReason,
      signal,
    );
  },
};
