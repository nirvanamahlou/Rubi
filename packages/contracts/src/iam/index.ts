export const IAM_PERMISSION_CODES = [
  'iam.users.read',
  'iam.users.manage',
  'iam.roles.read',
  'iam.roles.manage',
  'iam.sessions.manage',
  'iam.audit.read',
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
