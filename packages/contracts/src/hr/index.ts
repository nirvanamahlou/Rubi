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
  workedMinutes?: number;
  lateMinutes?: number | null;
  earlyMinutes?: number | null;
  overtimeMinutes?: number | null;
  exceptionCodes?: string[];
}

export interface HrContractStateCommand {
  version: number;
  state: 'SIGNED' | 'ACTIVE' | 'ENDED';
  signedDocumentId?: string;
  documentId?: string;
  reason?: string;
}

export interface HrEmployeeCreate {
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
export type HrEmployeeUpdate = Partial<HrEmployeeCreate> & { version: number };
export interface HrRecordCreate {
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
  version: number;
  /** Only organization units may be reparented; server checks branch and cycles. */
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
export interface HrBootstrapDto {
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
