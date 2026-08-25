export const IAM_PERMISSION_CONTRACT_VERSION = 3 as const;

export const IAM_CORE_PERMISSION_CODES = [
  'iam.users.read',
  'iam.users.manage',
  'iam.roles.read',
  'iam.roles.manage',
  'iam.sessions.manage',
  'iam.audit.read',
] as const;

export const MASTER_DATA_PERMISSION_CODES = [
  'master_data.read',
  'master_data.create',
  'master_data.update',
  'master_data.status.manage',
  'master_data.export',
] as const;

export const CUSTOMER_PERMISSION_CODES = [
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.merge',
  'customers.consent.manage',
  'customers.sensitive.read',
] as const;

export const LEGAL_ENTITY_PERMISSION_CODES = [
  'legal-entity.read',
  'legal-entity.switch',
  'legal-entity.aggregate.read',
  'legal-entity.manage',
  'legal-entity.branding.manage',
  'legal-entity.audit.read',
  'legal-entity.document.issue',
  'legal-entity.document.reissue',
] as const;

export const IAM_PERMISSION_CODES = [
  ...IAM_CORE_PERMISSION_CODES,
  ...MASTER_DATA_PERMISSION_CODES,
  ...CUSTOMER_PERMISSION_CODES,
  ...LEGAL_ENTITY_PERMISSION_CODES,
] as const;

export type IamPermissionCode = (typeof IAM_PERMISSION_CODES)[number];

export interface AuthenticatedActor {
  userId: string;
  sessionId: string;
  permissions: IamPermissionCode[];
  branchIds: string[];
}

export interface BranchReference {
  id: string;
  code: string;
  name: string;
}

export interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string | null;
    displayName: string;
    permissions: IamPermissionCode[];
    branches: BranchReference[];
  };
}
