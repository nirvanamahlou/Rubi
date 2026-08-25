import type { IamPermissionCode } from '@rubi/contracts';
import { LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES } from '@rubi/contracts';

export interface PermissionBearingRole {
  role: {
    isActive: boolean;
    permissions: Array<{ permission: { code: string } }>;
  };
}

export function authenticatedPermissionCodes(
  roles: readonly PermissionBearingRole[],
): IamPermissionCode[] {
  return [
    ...new Set<IamPermissionCode>([
      ...LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES,
      ...roles
        .filter(({ role }) => role.isActive)
        .flatMap(({ role }) =>
          role.permissions.map(
            ({ permission }) => permission.code as IamPermissionCode,
          ),
        ),
    ]),
  ];
}
