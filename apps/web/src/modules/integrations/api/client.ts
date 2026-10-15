import type {
  BranchReference,
  IntegrationExistingAdapterV1,
  IntegrationRegistryV1,
  IntegrationRegistryWriteV1,
} from '@nora/contracts';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export class IntegrationsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new IntegrationsApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await localizedFetch(`${base}/integrations/v1${path}`, {
    ...init,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new IntegrationsApiError(
      body?.error?.message ??
        body?.message ??
        'ارتباط با مرکز یکپارچه‌سازی برقرار نشد.',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

const branchQuery = (branchId: string) =>
  `?branchId=${encodeURIComponent(branchId)}`;
export const integrationsApi = {
  async branches(): Promise<BranchReference[]> {
    const base = getPublicApiBaseUrl();
    if (!base)
      throw new IntegrationsApiError('نشانی API پیکربندی نشده است.', 0);
    const session = await refreshAuthenticatedSession(base);
    if (!session)
      throw new IntegrationsApiError('برای ادامه باید وارد سامانه شوید.', 401);
    return session.user.branches;
  },
  read: (branchId: string, signal?: AbortSignal) =>
    request<IntegrationRegistryV1>(`/registry${branchQuery(branchId)}`, {
      ...(signal ? { signal } : {}),
    }),
  initialize: (branchId: string) =>
    request<IntegrationRegistryV1>(
      `/registry/initialize${branchQuery(branchId)}`,
      { method: 'POST' },
    ),
  write: (branchId: string, input: IntegrationRegistryWriteV1) =>
    request<IntegrationRegistryV1>(`/registry${branchQuery(branchId)}`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  adapters: (signal?: AbortSignal) =>
    request<IntegrationExistingAdapterV1[]>(
      '/adapters',
      signal ? { signal } : {},
    ),
};
