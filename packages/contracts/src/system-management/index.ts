export const SYSTEM_MANAGEMENT_CONTRACT_VERSION = 1 as const;

export const SYSTEM_PERMISSION_CODES = [
  'system.read',
  'system.settings.read',
  'system.settings.manage',
  'system.security.read',
  'system.security.manage',
  'system.users.read',
  'system.users.manage',
  'system.roles.read',
  'system.roles.manage',
  'system.permissions.read',
  'system.permissions.manage',
  'system.branches.read',
  'system.branches.manage',
  'system.legal_entities.read',
  'system.sessions.read',
  'system.sessions.revoke',
  'system.numbering.read',
  'system.numbering.manage',
  'system.notifications.read',
  'system.notifications.manage',
  'system.templates.read',
  'system.templates.manage',
  'system.audit.read',
  'system.audit.sensitive',
  'system.health.read',
  'system.jobs.retry',
  'system.feature_flags.read',
  'system.feature_flags.manage',
  'system.backup.request',
  'system.backup.read',
] as const;

export type SystemPermissionCode = (typeof SYSTEM_PERMISSION_CODES)[number];
export type SystemScope = 'GLOBAL' | 'LEGAL_ENTITY' | 'BRANCH' | 'USER';
export type SystemValueType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
export type SystemRecordStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface SystemSettingV1 {
  contract: 'system.setting.v1';
  id: string;
  namespace: string;
  key: string;
  valueType: SystemValueType;
  value: unknown;
  scope: SystemScope;
  scopeId: string | null;
  version: number;
  status: SystemRecordStatus;
  reason: string;
  updatedByUserId: string;
  updatedAt: string;
}

export interface SystemSettingWriteV1 {
  namespace: string;
  key: string;
  valueType: SystemValueType;
  value: unknown;
  scope: SystemScope;
  scopeId?: string | null;
  status?: SystemRecordStatus;
  reason: string;
  expectedVersion?: number;
}

export interface SystemSettingResolveQueryV1 {
  namespace: string;
  key: string;
  userId?: string;
  branchId?: string;
  legalEntityId?: string;
}

export interface SystemNumberingSchemeV1 {
  contract: 'system.numbering-scheme.v1';
  id: string;
  code: string;
  scope: SystemScope;
  scopeId: string | null;
  prefix: string;
  calendar: 'JALALI' | 'GREGORIAN';
  includeFiscalYear: boolean;
  includeLegalEntity: boolean;
  includeBranch: boolean;
  padding: number;
  resetPolicy: 'NEVER' | 'YEARLY' | 'MONTHLY';
  version: number;
  isActive: boolean;
}

export interface SystemNumberingSchemeWriteV1 extends Omit<
  SystemNumberingSchemeV1,
  'contract' | 'id' | 'version'
> {
  reason: string;
  expectedVersion?: number;
}

export interface SystemNumberIssueInputV1 {
  idempotencyKey: string;
  legalEntityCode?: string;
  branchCode?: string;
  now?: string;
}

export interface SystemNumberIssueV1 {
  contract: 'system.number-issued.v1';
  schemeId: string;
  value: string;
  sequence: string;
  periodKey: string;
}

export interface SystemFeatureFlagV1 {
  contract: 'system.feature-flag.v1';
  id: string;
  key: string;
  title: string;
  description: string | null;
  scope: SystemScope;
  scopeId: string | null;
  enabled: boolean;
  rolloutPercent: number | null;
  startsAt: string | null;
  endsAt: string | null;
  version: number;
  reason: string;
}

export interface SystemBackupRequestV1 {
  contract: 'system.backup-request.v1';
  id: string;
  type: 'FULL' | 'DATABASE' | 'FILES';
  status: 'REQUESTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  requestedByUserId: string;
  requestedAt: string;
  retentionUntil: string | null;
  sanitizedResult: string | null;
  sanitizedError: string | null;
}

export interface SystemSessionV1 {
  contract: 'system.session.v1';
  id: string;
  user: {
    id: string;
    username: string;
    displayName: string;
  };
  status: 'ACTIVE' | 'ROTATED' | 'REVOKED' | 'EXPIRED';
  isCurrent: boolean;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  ipAddressMasked: string | null;
  userAgentSummary: string | null;
}

export interface SystemSessionRevokeInputV1 {
  reason: string;
  confirmCurrentSession?: boolean;
}

export interface SystemUserSessionsRevokeInputV1 {
  reason: string;
  includeCurrentSession?: boolean;
  confirmCurrentSession?: boolean;
}

export interface SystemHealthComponentV1 {
  component: 'API' | 'POSTGRESQL' | 'REDIS' | 'WORKER' | 'STORAGE' | 'QUEUE';
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
  checkedAt: string;
  latencyMs: number | null;
  detail: string;
}

export interface SystemOverviewV1 {
  contract: 'system.overview.v1';
  generatedAt: string;
  settings: number;
  featureFlags: number;
  pendingBackupRequests: number;
  failedAdminOperations: number;
  health: SystemHealthComponentV1[];
}
