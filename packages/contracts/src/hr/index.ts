export * from './radan-completion';
export * from './radan-fields';
export * from './resource-registry';
export * from './connections';
export * from './directory';
import { HR_CONNECTION_PERMISSION_CODES } from './connections';

export const HR_CONTRACT_VERSION = 1 as const;
export const HR_PERMISSION_CODES = [
  ...HR_CONNECTION_PERMISSION_CODES,
  'hr.read',
  'hr.directory.read',
  'hr.manage',
  'hr.approve',
  'hr.sensitive',
  'hr.audit',
  'hr.self',
  'hr.team',
] as const;

export interface HrEmployeeDto {
  jobTitleId?: string | null;
  extension?: string;
  id: string;
  personnelCode: string;
  branchId: string;
  userId: string | null;
  photoDocumentId: string | null;
  organizationBranchId: string | null;
  companyName: string;
  name: string;
  kind: string;
  unit: string;
  position: string;
  grade: string;
  managerId: string | null;
  manager: string;
  startedAtValue: string;
  status: string;
  version: number;
}

export interface HrRecordDto {
  jobTitleId?: string | null;
  id: string;
  code: string;
  branchId: string;
  section: string;
  tab: string;
  employeeId: string | null;
  parentId: string | null;
  columns: string[];
  values: string[];
  version: number;
  status: string;
  effectiveAt: string | null;
  appliedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  data: HrWorkflowData;
}

/** Typed command inputs; no provider receipts or binary content are accepted. */
export interface HrWorkflowData {
  /** Persistent diagram offsets in CSS pixels, independent of personnel assignments. */
  chartX?: number;
  chartY?: number;
  /** Server-managed contract lifecycle. Generic record commands reject these fields. */
  contractState?: 'SIGNED' | 'ACTIVE' | 'ENDED';
  signedDocumentId?: string;
  contractStateChangedAt?: string;
  contractStateReason?: string;
  managerId?: string | null;
  targetBranchId?: string;
  organizationBranchId?: string;
  documentId?: string;
  startsAt?: string;
  endsAt?: string;
  minutes?: number;
  allowanceDays?: string;
  currency?: string;
  reason?: string;
  /** Server-derived attendance output; commands cannot supply these fields. */
  shiftEndDayOffset?: number;
  attendanceBeforeHours?: number;
  attendanceAfterHours?: number;
  workedMinutes?: number;
  lateMinutes?: number | null;
  earlyMinutes?: number | null;
  overtimeMinutes?: number | null;
  exceptionCodes?: string[];
  calculationSettingsId?: string;
  calculationBasis?: string;
  calculationMetrics?: Record<string, number>;
  /** Server managed workflow route; generic commands reject this field. */
  approvalRoute?: {
    employeeId: string;
    senior: boolean;
    priority: number;
    decidedBy?: string;
    decidedAt?: string;
  }[];
  approvalStep?: number;
  requestSubtype?: string;
  templateSchedule?: Record<string, { values: string[] }>;
}

export interface HrContractStateCommand {
  version: number;
  state: 'SIGNED' | 'ACTIVE' | 'ENDED';
  signedDocumentId?: string;
  documentId?: string;
  reason?: string;
}

export interface HrEmployeeCreate {
  jobTitleId?: string;
  /** Internal business phone extension; omit to preserve on edit, blank/null clears. */
  extension?: string | null;
  /** Optional atomic private personnel profile, using the existing identity/phone schemas. */
  identityValues?: string[];
  contactValues?: string[][];
  firstName?: string;
  lastName?: string;
  groupId?: string | null;
  branchId?: string;
  userId?: string | null;
  photoDocumentId?: string;
  organizationBranchId?: string;
  personnelCode?: string;
  name: string;
  kind: string;
  unit: string;
  position: string;
  grade: string;
  managerId?: string | null;
  startedAtValue: string;
  status?: string;
}
export type HrEmployeeUpdate = Partial<HrEmployeeCreate> & {
  version: number;
  /** Complete identity/contact snapshot required when editing private profile values. */
  profileRecords?: { id: string; version: number }[];
};
export interface HrRecordCreate {
  /** Write-only device credentials; never returned by record reads. */
  privateData?: { networkPassword?: string };
  branchId?: string;
  section: string;
  tab: string;
  employeeId?: string;
  parentId?: string;
  values: string[];
  status?: string;
  effectiveAt?: string;
  data?: HrWorkflowData;
}
export interface HrRecordUpdate {
  privateData?: { networkPassword?: string };
  version: number;
  /** Organization units and chart employee nodes support reparenting; server checks branch/company/cycles. */
  parentId?: string | null;
  values?: string[];
  status?: string;
  effectiveAt?: string;
  data?: HrWorkflowData;
}
export interface HrNotificationDto {
  id: string;
  action: string;
  recordId: string | null;
  employeeId: string | null;
  title: string;
  createdAt: string;
  readAt: string | null;
}
/** Complete, bounded HR-owner read model; references are not date-filtered operational rows. */
export interface HrAttendanceReportSnapshotDto {
  employees: HrEmployeeDto[];
  records: HrRecordDto[];
  references: HrRecordDto[];
}
export interface HrBootstrapDto {
  /** Shared non-sensitive catalogue; operational records retain branch authorization. */
  jobTitles?: { id: string; name: string; status: string }[];
  employees: HrEmployeeDto[];
  records: HrRecordDto[];
  capabilities: {
    read: boolean;
    write: boolean;
    approve: boolean;
    sensitive: boolean;
    audit: boolean;
    scope: 'branch' | 'team' | 'self';
  };
  branchIds: string[];
  branches: { id: string; name: string; code: string }[];
  integrations: {
    finance: 'UNAVAILABLE';
    documents: 'PUBLIC_API';
    notifications: 'HR_PERSISTENT';
    biometric: 'UNAVAILABLE';
  };
  recordCount: number;
  recordsTruncated: boolean;
  workflowWarnings?: { recordId: string; message: string }[];
}

/** Private HR aggregates; units are explicit and never converted between days/hours. */
export interface HrDashboardChartDto {
  id:
    | 'present'
    | 'quarterLate'
    | 'weeklyAttendance'
    | 'overtime'
    | 'departmentLate'
    | 'leave'
    | 'leaveBalance';
  title: string;
  description: string;
  from: string;
  to: string;
  points: {
    key: string;
    label: string;
    value: number;
    unit: 'نفر' | 'دقیقه' | 'ساعت' | 'روز' | 'درخواست';
  }[];
}
export interface HrDashboardChartsDto {
  asOf: string;
  charts: HrDashboardChartDto[];
}
