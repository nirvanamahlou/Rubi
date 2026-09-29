import type { IamPermissionCode } from '@nora/contracts';
import {
  LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES,
  USER_ACCESS_ADMIN_PERMISSION,
} from '@nora/contracts';

export interface PermissionBearingRole {
  role: {
    isActive: boolean;
    code?: string;
    name?: string;
    permissions: Array<{ permission: { code: string } }>;
  };
}

export function authenticatedPermissionCodes(
  roles: readonly PermissionBearingRole[],
): IamPermissionCode[] {
  const administrator = roles.some(
    ({ role }) => role.isActive && role.code === 'administrator',
  );
  const salesExpert = roles.some(
    ({ role }) =>
      role.isActive &&
      (role.code === 'sales_staff' || role.name === 'کارشناس فروش'),
  );
  const codes = [
    ...new Set<IamPermissionCode>([
      ...LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES,
      ...roles
        .filter(({ role }) => role.isActive)
        .flatMap(({ role }) =>
          role.permissions.map(
            ({ permission }) => permission.code as IamPermissionCode,
          ),
        )
        .filter((code) => code !== USER_ACCESS_ADMIN_PERMISSION),
      ...(administrator ? [USER_ACCESS_ADMIN_PERMISSION] : []),
    ]),
  ];
  if (!salesExpert) return codes;
  // A personal sales-expert profile remains own-scoped even with old broad grants.
  return [
    ...new Set(
      codes.map((code) => {
        if (
          code === 'sales.contracts.read.all' ||
          code === 'sales.contracts.read.branch'
        )
          return 'sales.contracts.read.own' as IamPermissionCode;
        if (code === 'sales.contracts.update.branch')
          return 'sales.contracts.update.own' as IamPermissionCode;
        return code;
      }),
    ),
  ];
}
