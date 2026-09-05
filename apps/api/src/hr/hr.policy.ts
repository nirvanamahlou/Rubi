import type { Employee, EmployeePrivateProfile } from './hr.entities';
import { requireInvariant, utc, validateReason } from './hr.domain';

export const hrPermissions = [
  'hr.read',
  'hr.create',
  'hr.update',
  'hr.status.manage',
  'hr.sensitive.read',
  'hr.contract.read',
  'hr.contract.manage',
  'hr.attendance.read',
  'hr.attendance.manage',
  'hr.leave.request',
  'hr.leave.approve',
  'hr.recruitment.manage',
  'hr.performance.read',
  'hr.performance.manage',
  'hr.training.manage',
  'hr.compensation.read',
  'hr.compensation.manage',
  'hr.documents.read',
  'hr.documents.manage',
  'hr.reports.read',
  'hr.settings.manage',
  'hr.scope.multibranch',
] as const;
export type HrPermission = (typeof hrPermissions)[number];
/** Trusted server-side IAM adapter input, never client-supplied claims. */
export interface HrActor {
  userId: string;
  employeeId?: string;
  permissions: readonly HrPermission[];
  branchIds: readonly string[];
  activeBranchId: string;
  scope: 'SELF' | 'MANAGER' | 'HR';
  managedEmployeeIds: readonly string[];
}
export interface HrTarget {
  employeeId: string;
  branchId: string;
}
const selfPermissions: readonly HrPermission[] = [
  'hr.read',
  'hr.leave.request',
  'hr.documents.read',
];
const managerPermissions: readonly HrPermission[] = [
  'hr.read',
  'hr.contract.read',
  'hr.attendance.read',
  'hr.leave.approve',
  'hr.performance.read',
  'hr.performance.manage',
  'hr.documents.read',
];
export function canAccess(
  actor: HrActor | null,
  permission: HrPermission,
  target: HrTarget,
): boolean {
  if (
    !actor?.userId ||
    !actor.permissions.includes(permission) ||
    !actor.branchIds.includes(target.branchId)
  )
    return false;
  if (
    target.branchId !== actor.activeBranchId &&
    !actor.permissions.includes('hr.scope.multibranch')
  )
    return false;
  if (actor.scope === 'SELF')
    return (
      actor.employeeId === target.employeeId &&
      selfPermissions.includes(permission)
    );
  if (actor.scope === 'MANAGER')
    return (
      managerPermissions.includes(permission) &&
      actor.managedEmployeeIds.includes(target.employeeId) &&
      actor.employeeId !== target.employeeId
    );
  return actor.scope === 'HR';
}
export function authorize(
  actor: HrActor | null,
  permission: HrPermission,
  target: HrTarget,
): asserts actor is HrActor {
  requireInvariant(canAccess(actor, permission, target), 'FORBIDDEN');
}
/** Allowlist projection avoids leaking future fields added to the private profile. */
export function employeeSummary(employee: Employee) {
  return {
    id: employee.id,
    personnelCode: employee.personnelCode,
    firstNameFa: employee.firstNameFa,
    lastNameFa: employee.lastNameFa,
    status: employee.status,
    version: employee.version,
    nationalId: '••••••••',
    bankReference: '••••••••',
    compensation: '••••••••',
  } as const;
}
export const sensitiveFields = [
  'nationalId',
  'phone',
  'email',
  'address',
  'emergencyContact',
  'bankReferenceId',
  'insuranceNumber',
  'medicalNote',
  'disciplinaryNote',
] as const;
export type SensitiveField = (typeof sensitiveFields)[number];
export type AuditReasonCode =
  'EMPLOYEE_REQUEST' | 'HR_REVIEW' | 'LEGAL_OBLIGATION';
export interface HrAuditEvent {
  actorUserId: string;
  targetId: string;
  action: 'SENSITIVE_READ' | 'MUTATION' | 'DOCUMENT_READ';
  field?: SensitiveField;
  reasonCode: AuditReasonCode;
  occurredAt: string;
  traceId: string;
}
export interface HrAuditPort {
  append(event: HrAuditEvent): Promise<void>;
}
export interface SensitiveProfilePort {
  readField(
    employeeId: string,
    field: SensitiveField,
  ): Promise<EmployeePrivateProfile[SensitiveField]>;
}
/** Fail closed: access and durable audit must succeed before the private value is read. */
export async function revealSensitive(
  input: {
    actor: HrActor | null;
    target: HrTarget;
    field: SensitiveField;
    reason: string;
    reasonCode: AuditReasonCode;
    now: string;
    traceId: string;
  },
  audit: HrAuditPort,
  profiles: SensitiveProfilePort,
): Promise<string | undefined> {
  authorize(input.actor, 'hr.sensitive.read', input.target);
  requireInvariant(sensitiveFields.includes(input.field));
  requireInvariant(
    ['EMPLOYEE_REQUEST', 'HR_REVIEW', 'LEGAL_OBLIGATION'].includes(
      input.reasonCode,
    ),
  );
  validateReason(input.reason);
  utc(input.now);
  requireInvariant(Boolean(input.traceId.trim()));
  // Free text may itself contain PII. Audit the validated purpose code, never the raw reason/value.
  await audit.append({
    actorUserId: input.actor.userId,
    targetId: input.target.employeeId,
    action: 'SENSITIVE_READ',
    field: input.field,
    reasonCode: input.reasonCode,
    occurredAt: input.now,
    traceId: input.traceId,
  });
  return profiles.readField(input.target.employeeId, input.field);
}
