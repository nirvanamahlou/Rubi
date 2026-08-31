import type { ConfidentialityLevel } from './documents.contracts';

export const documentPermissionCodes = [
  'documents.read',
  'documents.upload',
  'documents.version.create',
  'documents.download',
  'documents.sensitive.read',
  'documents.sensitive.download',
  'documents.archive',
  'documents.restore',
  'documents.audit.read',
  'documents.retention.manage',
  'documents.legal_hold.manage',
  'documents.quarantine.manage',
] as const;

export type DocumentPermissionCode = (typeof documentPermissionCodes)[number];

export interface DocumentsActorContext {
  readonly actorReference: string;
  readonly branchReferences: readonly string[];
  readonly permissions: readonly string[];
}

export type DocumentAuthorizationAction =
  | 'READ'
  | 'DOWNLOAD'
  | 'UPLOAD'
  | 'VERSION_CREATE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'AUDIT_READ'
  | 'RETENTION_MANAGE'
  | 'LEGAL_HOLD_MANAGE'
  | 'QUARANTINE_MANAGE';

export interface DocumentAuthorizationRequest {
  readonly action: DocumentAuthorizationAction;
  readonly branchReference: string;
  readonly confidentiality: ConfidentialityLevel;
  readonly reason: string | null;
}

export interface DocumentAuthorizationDecision {
  readonly allowed: boolean;
  readonly masked: boolean;
  readonly code:
    | 'ALLOWED'
    | 'PERMISSION_REQUIRED'
    | 'BRANCH_SCOPE_DENIED'
    | 'SENSITIVE_PERMISSION_REQUIRED'
    | 'SENSITIVE_REASON_REQUIRED';
}

const actionPermission: Readonly<
  Record<DocumentAuthorizationAction, DocumentPermissionCode>
> = {
  READ: 'documents.read',
  DOWNLOAD: 'documents.download',
  UPLOAD: 'documents.upload',
  VERSION_CREATE: 'documents.version.create',
  ARCHIVE: 'documents.archive',
  RESTORE: 'documents.restore',
  AUDIT_READ: 'documents.audit.read',
  RETENTION_MANAGE: 'documents.retention.manage',
  LEGAL_HOLD_MANAGE: 'documents.legal_hold.manage',
  QUARANTINE_MANAGE: 'documents.quarantine.manage',
};

function isSensitive(level: ConfidentialityLevel): boolean {
  return level === 'CONFIDENTIAL' || level === 'RESTRICTED';
}

export function authorizeDocumentAction(
  actor: DocumentsActorContext | null,
  request: DocumentAuthorizationRequest,
): DocumentAuthorizationDecision {
  if (!actor || !actor.permissions.includes(actionPermission[request.action])) {
    return {
      allowed: false,
      masked: request.action === 'READ',
      code: 'PERMISSION_REQUIRED',
    };
  }
  if (!actor.branchReferences.includes(request.branchReference)) {
    return { allowed: false, masked: false, code: 'BRANCH_SCOPE_DENIED' };
  }
  if (isSensitive(request.confidentiality)) {
    const permission =
      request.action === 'DOWNLOAD'
        ? 'documents.sensitive.download'
        : 'documents.sensitive.read';
    if (!actor.permissions.includes(permission)) {
      return {
        allowed: false,
        masked: request.action === 'READ',
        code: 'SENSITIVE_PERMISSION_REQUIRED',
      };
    }
    if (
      (request.action === 'READ' || request.action === 'DOWNLOAD') &&
      (request.reason?.trim().length ?? 0) < 5
    ) {
      return {
        allowed: false,
        masked: request.action === 'READ',
        code: 'SENSITIVE_REASON_REQUIRED',
      };
    }
  }
  return { allowed: true, masked: false, code: 'ALLOWED' };
}
