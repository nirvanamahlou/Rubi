import type {
  BranchReference,
  IntegrationExistingAdapterV1,
  IntegrationRegistryV1,
  IntegrationRegistryWriteV1,
  IntegrationAccessSection,
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
  ssoAccess: (branchId: string, signal?: AbortSignal) =>
    request<{ enabled: boolean; launchUrl?: string; noraOrigin?: string }>(
      `/niyayesh/sso/access${branchQuery(branchId)}`,
      signal ? { signal } : {},
    ),
  launchSso: async (branchId: string) => {
    const base = getPublicApiBaseUrl();
    if (!base || !(await refreshAuthenticatedSession(base)))
      throw new IntegrationsApiError('دوباره وارد نورا شوید.', 401);
    const access = await integrationsApi.ssoAccess(branchId);
    if (!access.enabled || !access.launchUrl)
      throw new IntegrationsApiError('ورود شخصی برای شما فعال نیست.', 403);
    if (access.noraOrigin && access.noraOrigin !== window.location.origin) {
      window.location.assign(
        new URL('/integrations', access.noraOrigin).toString(),
      );
      return;
    }
    window.location.assign(access.launchUrl);
  },
  niyayeshStatus: (branchId: string, signal?: AbortSignal) =>
    request<{
      state: string;
      environment?: string;
      checkedAt?: string;
      resources: { code: string; title: string }[];
    }>(`/niyayesh/status${branchQuery(branchId)}`, signal ? { signal } : {}),
  niyayeshResources: (
    branchId: string,
    resource: string,
    after: number,
    signal?: AbortSignal,
  ) =>
    request<{
      schemaVersion: number;
      items: {
        externalId: string;
        version: number;
        archived: boolean;
        data: Record<string, unknown> | null;
      }[];
      nextId: number;
      hasMore: boolean;
    }>(
      `/niyayesh/resources${branchQuery(branchId)}&resource=${encodeURIComponent(resource)}&after=${after}`,
      signal ? { signal } : {},
    ),
  async branches(): Promise<BranchReference[]> {
    const base = getPublicApiBaseUrl();
    if (!base)
      throw new IntegrationsApiError('نشانی API پیکربندی نشده است.', 0);
    const session = await refreshAuthenticatedSession(base);
    if (!session)
      throw new IntegrationsApiError('برای ادامه باید وارد سامانه شوید.', 401);
    return session.user.branches;
  },
  read: (
    branchId: string,
    signal?: AbortSignal,
    section?: IntegrationAccessSection,
  ) =>
    request<IntegrationRegistryV1>(
      `/registry${branchQuery(branchId)}${section ? `&section=${section}` : ''}`,
      {
        ...(signal ? { signal } : {}),
      },
    ),
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
