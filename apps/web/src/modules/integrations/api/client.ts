import type {
  BranchReference,
  SiteConnectionInputV1,
  SiteConnectionStatusV1,
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
export interface GhestirooStatus {
  configured: boolean;
  storageReady: boolean;
  canManage: boolean;
  version: number;
  origin?: string;
  connectionId?: string;
  expiresAt?: string;
  scopes?: string[];
  allowedUserIds?: string[];
  autoRenewal?: boolean;
  lastRenewedAt?: string;
  renewalState?: 'active' | 'pending' | 'retrying' | 'expired';
}
const siteBranchQuery = (branchId: string, systemId?: string) =>
  `${branchQuery(branchId)}${systemId ? `&systemId=${encodeURIComponent(systemId)}` : ''}`;
export const siteConnectionApi = {
  bundle: (
    branch: string,
    site: string,
    bundle: string,
    expectedVersion: number,
  ) =>
    request<SiteConnectionStatusV1>(
      `/sites/${encodeURIComponent(site)}/bundle${branchQuery(branch)}`,
      {
        method: 'POST',
        body: JSON.stringify({ bundle, expectedVersion }),
        headers: { 'X-Nora-Site-Connection': '1' },
      },
    ),
  lifecycle: (
    branch: string,
    site: string,
    action: 'disconnect' | 'delete',
    operationId: string,
    expectedVersion: number,
  ) =>
    request<SiteConnectionStatusV1>(
      `/sites/${encodeURIComponent(site)}/lifecycle${branchQuery(branch)}`,
      {
        method: 'POST',
        body: JSON.stringify({ action, operationId, expectedVersion }),
        headers: { 'X-Nora-Site-Connection': '1' },
      },
    ),
  status: (branch: string, site: string, signal?: AbortSignal) =>
    request<SiteConnectionStatusV1>(
      `/sites/${encodeURIComponent(site)}/connection${branchQuery(branch)}`,
      signal ? { signal } : {},
    ),
  save: (branch: string, site: string, input: SiteConnectionInputV1) =>
    request<SiteConnectionStatusV1>(
      `/sites/${encodeURIComponent(site)}/connection${branchQuery(branch)}`,
      {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'X-Nora-Site-Connection': '1' },
      },
    ),
  test: (branch: string, site: string) =>
    request<{
      state: string;
      checkedAt?: string;
      resources: { code: string; title: string }[];
    }>(`/sites/${encodeURIComponent(site)}/test${branchQuery(branch)}`, {
      method: 'POST',
      headers: { 'X-Nora-Site-Connection': '1' },
    }),
};
export const ghestirooApi = {
  workspace: (
    branch: string,
    payload: Record<string, unknown>,
    file?: File,
  ) => {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    if (file) form.append('file', file);
    return request<Record<string, unknown>>(
      `/ghestiroo/workspace${branchQuery(branch)}`,
      { method: 'POST', body: form, headers: { 'X-Nora-Workspace': '1' } },
    );
  },
  status: (branch: string, signal?: AbortSignal) =>
    request<GhestirooStatus>(`/ghestiroo/connection${branchQuery(branch)}`, {
      ...(signal ? { signal } : {}),
    }),
  save: (
    branch: string,
    bundle: string,
    allowedUserIds: string[],
    expectedVersion: number,
  ) =>
    request<GhestirooStatus>(`/ghestiroo/connection${branchQuery(branch)}`, {
      method: 'POST',
      body: JSON.stringify({ bundle, allowedUserIds, expectedVersion }),
    }),
  test: (branch: string) =>
    request<{ scopes: string[]; checkedAt: string }>(
      `/ghestiroo/test${branchQuery(branch)}`,
      { method: 'POST' },
    ),
  resources: (branch: string, resource: string, after = '') =>
    request<{ items: Record<string, unknown>[]; nextCursor: string | null }>(
      `/ghestiroo/resources/${resource}${branchQuery(branch)}${after ? `&after=${encodeURIComponent(after)}` : ''}`,
    ),
  grant: (branch: string) =>
    request<{ action: string; token: string; expiresIn: number }>(
      `/ghestiroo/admin-grants${branchQuery(branch)}`,
      { method: 'POST' },
    ),
};
export const integrationsApi = {
  siteReport: (
    branch: string,
    from: string,
    to: string,
    signal: AbortSignal | undefined,
    systemId: string,
    connector: 'ghestiroo' | 'niyayesh',
  ): Promise<SiteReport> =>
    connector === 'ghestiroo'
      ? request<SiteReport>(
          `/ghestiroo/dashboard${branchQuery(branch)}&systemId=${encodeURIComponent(systemId)}`,
          {
            method: 'POST',
            body: JSON.stringify({ from, to }),
            ...(signal ? { signal } : {}),
          },
        )
      : integrationsApi.niyayeshReport(branch, from, to, signal, systemId),
  siteReportDetails: (
    branch: string,
    systemId: string,
    connector: 'ghestiroo' | 'niyayesh',
    report: {
      from: string;
      to: string;
      metric: string;
      after: string | number;
      queue?: string;
    },
  ): Promise<{
    items: { externalId: string; data: Record<string, unknown> | null }[];
    nextId: string | number;
    hasMore: boolean;
  }> =>
    connector === 'ghestiroo'
      ? request<{
          items: { externalId: string; data: Record<string, unknown> | null }[];
          nextId: string | number;
          hasMore: boolean;
          registrySystemId: string;
        }>(
          `/ghestiroo/dashboard${branchQuery(branch)}&systemId=${encodeURIComponent(systemId)}`,
          {
            method: 'POST',
            body: JSON.stringify({
              ...report,
              after: report.after ? String(report.after) : '',
            }),
          },
        )
      : integrationsApi.niyayeshResources(
          branch,
          report.metric === 'users' ? 'customer-accounts' : 'customer-orders',
          Number(report.after),
          undefined,
          undefined,
          { ...report, systemId },
        ),
  sitePresence: (
    branchId: string,
    systemId: string,
    signal: AbortSignal,
    connector = 'niyayesh',
  ) =>
    request<SitePresenceV1>(
      `/${connector === 'ghestiroo' ? 'ghestiroo' : 'niyayesh'}/presence${branchQuery(branchId)}&systemId=${encodeURIComponent(systemId)}`,
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
    systemId?: string,
  ) =>
    request<EditorContract>(
      `/niyayesh/catalogue/${encodeURIComponent(resource)}${siteBranchQuery(branchId, systemId)}${id ? `&id=${encodeURIComponent(id)}` : ''}`,
      signal ? { signal } : {},
    ),
  niyayeshSave: (
    branchId: string,
    resource: string,
    value: Record<string, unknown>,
    command: string,
    record?: { externalId: string; version: number | string },
    systemId?: string,
  ) =>
    request<Record<string, unknown>>(
      `/niyayesh/catalogue/${encodeURIComponent(resource)}${siteBranchQuery(branchId, systemId)}`,
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
  niyayeshHotelExport: (branchId: string, city: string, systemId?: string) =>
    request<{ filename: string; content: string }>(
      `/niyayesh/workbooks/hotels/export${siteBranchQuery(branchId, systemId)}&city=${encodeURIComponent(city)}`,
    ),
  niyayeshDashboard: (
    branchId: string,
    signal?: AbortSignal,
    systemId?: string,
  ) =>
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
      imports: { kind: string; canApply: boolean; canExport?: boolean }[];
    }>(
      `/niyayesh/dashboard${siteBranchQuery(branchId, systemId)}`,
      signal ? { signal } : {},
    ),
  niyayeshTemplate: (branchId: string, kind: string, systemId?: string) =>
    request<{ filename: string; content: string }>(
      `/niyayesh/workbooks/${encodeURIComponent(kind)}/template${siteBranchQuery(branchId, systemId)}`,
    ),
  niyayeshWorkbook: (
    branchId: string,
    kind: string,
    file: File,
    command: string,
    apply: boolean,
    tourId?: string,
    proof?: string,
    systemId?: string,
  ) => {
    const form = new FormData();
    form.append('file', file);
    const query = new URLSearchParams({
      branchId,
      ...(systemId ? { systemId } : {}),
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
  ssoAccess: (branchId: string, signal?: AbortSignal, systemId?: string) =>
    request<{ enabled: boolean; launchUrl?: string; noraOrigin?: string }>(
      `/niyayesh/sso/access${siteBranchQuery(branchId, systemId)}`,
      signal ? { signal } : {},
    ),
  launchSso: async (branchId: string, systemId?: string) => {
    const base = getPublicApiBaseUrl();
    if (!base || !(await refreshAuthenticatedSession(base)))
      throw new IntegrationsApiError('دوباره وارد نورا شوید.', 401);
    const access = await integrationsApi.ssoAccess(
      branchId,
      undefined,
      systemId,
    );
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
  niyayeshStatus: (branchId: string, signal?: AbortSignal, systemId?: string) =>
    request<{
      registrySystemId?: string;
      state: string;
      environment?: string;
      checkedAt?: string;
      resources: { code: string; title: string }[];
    }>(
      `/niyayesh/status${siteBranchQuery(branchId, systemId)}`,
      signal ? { signal } : {},
    ),
  niyayeshResources: (
    branchId: string,
    resource: string,
    after: number,
    signal?: AbortSignal,
    metric?: string,
    report?: { metric: string; from: string; to: string; systemId?: string },
    systemId?: string,
    filter?: { query?: string; status?: string },
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
      `/niyayesh/resources${siteBranchQuery(branchId, systemId ?? report?.systemId)}&resource=${encodeURIComponent(resource)}&after=${after}${metric ? `&metric=${encodeURIComponent(metric)}` : ''}${report ? `&reportMetric=${encodeURIComponent(report.metric)}&from=${encodeURIComponent(report.from)}&to=${encodeURIComponent(report.to)}` : ''}${filter?.query ? `&q=${encodeURIComponent(filter.query)}` : ''}${filter?.status ? `&status=${encodeURIComponent(filter.status)}` : ''}`,
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
    version: number | string;
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
    available?: boolean;
    coverageFrom?: string | null;
    pageViews: number;
    uniqueBrowsers: number;
    definition: string;
    daily: { date: string; views: number; visitors: number }[];
  };
  activity: {
    id?: string;
    resource: string;
    externalId: string;
    operation: string;
    occurredAt: string;
    origin: string;
    version: number;
  }[];
  activityAvailable: boolean;
  definitions?: Record<string, string>;
  queues?: { id: string; title: string; count: number }[];
  queueDefinition?: string;
  warnings?: string[];
};

export type SitePresenceV1 = {
  schemaVersion: 1;
  mapKind?: 'SITE_NAVIGATION';
  groups?: { id: string; title: string }[];
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
    group?: string;
    column: number | null;
    row: number | null;
    count: number | null;
  }[];
  edges: { from: string; to: string; kind?: 'navigation' | 'booking' }[];
};
