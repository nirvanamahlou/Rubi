import type {
  SystemBackupRequestV1,
  SystemFeatureFlagV1,
  SystemNumberingSchemeV1,
  SystemNumberingSchemeWriteV1,
  SystemReportingExportRetryInputV1,
  SystemSessionRevokeInputV1,
  SystemSessionV1,
  SystemSettingV1,
  SystemSettingWriteV1,
  SystemUserSessionsRevokeInputV1,
} from '@nora/contracts';

import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export class SystemManagementApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface SystemOverview {
  contract: 'system.overview.v1';
  generatedAt: string;
  settings: number;
  featureFlags: number;
  pendingBackupRequests: number;
  failedAdminOperations: number;
  health: Array<{
    component: string;
    status: string;
    checkedAt: string;
    latencyMs: number | null;
    detail: string;
  }>;
}

export interface NotificationChannelWrite {
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  enabled: boolean;
  templateRef?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  retryPolicy?: Record<string, unknown>;
  expectedVersion?: number;
  reason: string;
}

export interface MessageTemplateWrite {
  key: string;
  kind: 'MESSAGE' | 'EMAIL' | 'SMS' | 'NOTIFICATION';
  language: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  subject?: string | null;
  body: string;
  allowedVariables?: string[];
  reason: string;
}

export interface FeatureFlagWrite {
  key: string;
  title: string;
  description?: string | null;
  scope: 'GLOBAL' | 'LEGAL_ENTITY' | 'BRANCH' | 'USER';
  scopeId?: string | null;
  enabled: boolean;
  rolloutPercent?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  expectedVersion?: number;
  reason: string;
}

export interface BackupRequestWrite {
  type: 'FULL' | 'DATABASE' | 'FILES';
  reason: string;
  retentionUntil?: string | null;
}

export interface SystemAuditRecord {
  id: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  outcome: string;
  reason: string;
  requestId: string | null;
  ipAddressMasked: string | null;
  createdAt: string;
}

export interface ContractTemplateUploadResult {
  id: string;
  originalFileName: string;
  scanStatus: string;
  sizeBytes: number;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retriedAfterRefresh = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl)
    throw new SystemManagementApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/system-management/v1${path}`, {
    cache: 'no-store',
    credentials: 'include',
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
    throw new SystemManagementApiError(
      envelope?.error?.message ??
        envelope?.message ??
        'عملیات مدیریت سامانه ناموفق بود.',
      response.status,
      envelope?.error?.code ?? envelope?.code,
    );
  }
  return response.json() as Promise<T>;
}

function json(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  };
}

export const systemManagementApi = {
  overview: () => request<SystemOverview>('/overview'),
  settings: () => request<SystemSettingV1[]>('/settings'),
  resolveSetting: (namespace: string, key: string) =>
    request<SystemSettingV1 | null>(
      `/settings/resolve?namespace=${encodeURIComponent(namespace)}&key=${encodeURIComponent(key)}`,
    ),
  writeSetting: (input: SystemSettingWriteV1) =>
    request<SystemSettingV1>('/settings', json(input)),
  uploadContractTemplate: (form: FormData) =>
    request<ContractTemplateUploadResult>('/contract-templates', {
      body: form,
      method: 'POST',
    }),
  numberingSchemes: () =>
    request<SystemNumberingSchemeV1[]>('/numbering-schemes'),
  writeNumberingScheme: (input: SystemNumberingSchemeWriteV1) =>
    request<SystemNumberingSchemeV1>('/numbering-schemes', json(input)),
  previewNumber: (
    id: string,
    input: { branchCode?: string; legalEntityCode?: string; now?: string },
  ) => request(`/numbering-schemes/${id}/preview`, json(input)),
  sessions: () => request<SystemSessionV1[]>('/sessions'),
  revokeSession: (id: string, input: SystemSessionRevokeInputV1) =>
    request(`/sessions/${id}/revoke`, json(input)),
  revokeUserSessions: (id: string, input: SystemUserSessionsRevokeInputV1) =>
    request(`/sessions/users/${id}/revoke`, json(input)),
  notificationChannels: () =>
    request<NotificationChannelWrite[]>('/notification-channels'),
  writeNotificationChannel: (input: NotificationChannelWrite) =>
    request('/notification-channels', json(input)),
  templates: () => request<MessageTemplateWrite[]>('/templates'),
  createTemplate: (input: MessageTemplateWrite) =>
    request('/templates', json(input)),
  featureFlags: () => request<SystemFeatureFlagV1[]>('/feature-flags'),
  writeFeatureFlag: (input: FeatureFlagWrite) =>
    request<SystemFeatureFlagV1>('/feature-flags', json(input)),
  backupRequests: () => request<SystemBackupRequestV1[]>('/backup-requests'),
  requestBackup: (input: BackupRequestWrite) =>
    request<SystemBackupRequestV1>('/backup-requests', json(input)),
  retryReportingExport: (
    id: string,
    input: SystemReportingExportRetryInputV1,
  ) => request(`/jobs/reporting-exports/${id}/retry`, json(input)),
  health: () => request<SystemOverview['health']>('/health'),
  audit: () => request<SystemAuditRecord[]>('/audit'),
};
