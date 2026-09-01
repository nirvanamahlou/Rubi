import type {
  BranchReference,
  DocumentAuditResponseV1,
  DocumentDetailResponseV1,
  DocumentListQueryV1,
  DocumentListResponseV1,
  DocumentOptionsResponseV1,
  LoginResponse,
} from '@rubi/contracts';

import { getPublicApiBaseUrl } from '../../../lib/environment';

export class DocumentsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

let refreshInFlight: Promise<LoginResponse | null> | null = null;

async function refreshAccess(baseUrl: string) {
  refreshInFlight ??= fetch(`${baseUrl}/iam/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  })
    .then(async (response) =>
      response.ok ? ((await response.json()) as LoginResponse) : null,
    )
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
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
    (await refreshAccess(baseUrl))
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
        ? { headers: { 'x-sensitive-read-reason': sensitiveReason } }
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
  async sessionContext(): Promise<LoginResponse['user']> {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl)
      throw new DocumentsApiError('نشانی API پیکربندی نشده است.', 0);
    const session = await refreshAccess(baseUrl);
    if (!session?.user)
      throw new DocumentsApiError('دریافت اطلاعات کاربر ناموفق بود.', 0);
    return session.user;
  },
  async branchReferences(): Promise<readonly BranchReference[]> {
    return (await this.sessionContext()).branches;
  },
  async download(id: string, sensitiveReason?: string) {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl)
      throw new DocumentsApiError('نشانی API پیکربندی نشده است.', 0);
    const response = await fetch(
      `${baseUrl}/documents/${encodeURIComponent(id)}/download`,
      {
        credentials: 'include',
        cache: 'no-store',
        ...(sensitiveReason
          ? { headers: { 'x-sensitive-read-reason': sensitiveReason } }
          : {}),
      },
    );
    if (!response.ok) {
      const envelope = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new DocumentsApiError(
        envelope?.message ?? 'دریافت فایل مجاز نیست.',
        response.status,
      );
    }
    return {
      blob: await response.blob(),
      disposition: response.headers.get('content-disposition'),
    };
  },
};
