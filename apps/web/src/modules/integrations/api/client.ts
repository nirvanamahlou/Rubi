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
      ...(init.body && !(init.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
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
  sitePresence: (branchId: string, systemId: string, signal: AbortSignal) =>
    request<SitePresenceV1>(
      `/niyayesh/presence${branchQuery(branchId)}&systemId=${encodeURIComponent(systemId)}`,
      { signal },
    ),
  niyayeshReport: (
    branchId: string,
    from: string,
    to: string,
    signal?: AbortSignal,
    systemId?: string,
  ) =>
    request<SiteReport>(
      `/niyayesh/report${branchQuery(branchId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${systemId ? `&systemId=${encodeURIComponent(systemId)}` : ''}`,
      signal ? { signal } : {},
    ),
  niyayeshEditor: (
    branchId: string,
    resource: string,
    id?: string,
    signal?: AbortSignal,
  ) =>
    request<EditorContract>(
      `/niyayesh/catalogue/${encodeURIComponent(resource)}${branchQuery(branchId)}${id ? `&id=${encodeURIComponent(id)}` : ''}`,
      signal ? { signal } : {},
    ),
  niyayeshSave: (
    branchId: string,
    resource: string,
    value: Record<string, unknown>,
    command: string,
    record?: { externalId: string; version: number },
  ) =>
    request<Record<string, unknown>>(
      `/niyayesh/catalogue/${encodeURIComponent(resource)}${branchQuery(branchId)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          value,
          command,
          ...(record
            ? { id: record.externalId, version: String(record.version) }
            : {}),
        }),
      },
    ),
  niyayeshHotelExport: (branchId: string, city: string) =>
    request<{ filename: string; content: string }>(
      `/niyayesh/workbooks/hotels/export${branchQuery(branchId)}&city=${encodeURIComponent(city)}`,
    ),
  niyayeshDashboard: (branchId: string, signal?: AbortSignal) =>
    request<{
      state: string;
      environment?: string;
      checkedAt?: string;
      metrics: {
        key: string;
        resource: string;
        title: string;
        definition: string;
        value: number | null;
        state: string;
      }[];
      imports: { kind: string; canApply: boolean }[];
    }>(`/niyayesh/dashboard${branchQuery(branchId)}`, signal ? { signal } : {}),
  niyayeshTemplate: (branchId: string, kind: string) =>
    request<{ filename: string; content: string }>(
      `/niyayesh/workbooks/${encodeURIComponent(kind)}/template${branchQuery(branchId)}`,
    ),
  niyayeshWorkbook: (
    branchId: string,
    kind: string,
    file: File,
    command: string,
    apply: boolean,
    tourId?: string,
    proof?: string,
  ) => {
    const form = new FormData();
    form.append('file', file);
    const query = new URLSearchParams({
      branchId,
      command,
      apply: String(apply),
      ...(tourId ? { tourId } : {}),
      ...(proof ? { proof } : {}),
    });
    return request<{
      proof: string | null;
      revision: number;
      result: Record<string, unknown> & {
        valid: boolean;
        applied: boolean;
        warnings: string[];
        errors: string[];
      };
    }>(`/niyayesh/workbooks/${encodeURIComponent(kind)}?${query}`, {
      method: 'POST',
      body: form,
      headers: { 'X-Nora-Workbook': '1' },
    });
  },
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
      registrySystemId?: string;
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
    metric?: string,
    report?: { metric: string; from: string; to: string; systemId?: string },
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
      `/niyayesh/resources${branchQuery(branchId)}&resource=${encodeURIComponent(resource)}&after=${after}${metric ? `&metric=${encodeURIComponent(metric)}` : ''}${report ? `&reportMetric=${encodeURIComponent(report.metric)}&from=${encodeURIComponent(report.from)}&to=${encodeURIComponent(report.to)}${report.systemId ? `&systemId=${encodeURIComponent(report.systemId)}` : ''}` : ''}`,
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

export type EditorSchema = {
  $ref?: string;
  $defs?: Record<string, EditorSchema>;
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, EditorSchema>;
  items?: EditorSchema;
  anyOf?: EditorSchema[];
  enum?: (string | number | boolean)[];
  default?: unknown;
  required?: string[];
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
};
export type EditorContract = {
  schemaVersion: number;
  resource: string;
  title: string;
  createSchema: EditorSchema;
  updateSchema: EditorSchema;
  canCreate: boolean;
  canUpdate: boolean;
  canPublish: boolean;
  lookups: Record<string, string>;
  groups: Record<string, string[]>;
  record: {
    externalId: string;
    version: number;
    value: Record<string, unknown>;
    data: Record<string, unknown>;
  } | null;
};
export type SiteReport = {
  schemaVersion: number;
  registrySystemId?: string;
  environment: string;
  checkedAt: string;
  from: string;
  to: string;
  metrics: Record<string, { value: number | null; state: string }>;
  totals: Record<string, number | null>;
  salesByCurrency:
    { currency: string; amount: string | null; complete: boolean }[] | null;
  trends: Record<string, { date: string; value: number }[]>;
  visits: {
    pageViews: number;
    uniqueBrowsers: number;
    definition: string;
    daily: { date: string; views: number; visitors: number }[];
  };
  activity: {
    resource: string;
    externalId: string;
    operation: string;
    occurredAt: string;
    origin: string;
    version: number;
  }[];
  activityAvailable: boolean;
};

export type SitePresenceV1 = {
  schemaVersion: 1;
  state: 'ACTIVE' | 'NOT_CONFIGURED';
  registrySystemId: string;
  environment: string;
  checkedAt: string;
  activeWindowSeconds: number;
  heartbeatSeconds: number;
  total: number | null;
  nodes: {
    id: string;
    title: string;
    kind: string;
    column: number | null;
    row: number | null;
    count: number | null;
  }[];
  edges: { from: string; to: string }[];
};
