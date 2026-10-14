import type { IamPermissionCode } from '@nora/contracts';
import {
  LEGAL_ENTITY_AUTHENTICATED_BASELINE_PERMISSION_CODES,
  USER_ACCESS_ADMIN_PERMISSION,
  MANUAL_ACCESS_ROLE_PREFIX,
  MANUAL_ACCESS_VERSION,
} from '@nora/contracts';

export interface PermissionBearingRole {
  role: {
    isActive: boolean;
    code?: string;
    name?: string;
    permissions: Array<{ permission: { code: string } }>;
  };
}

function salesRolePolicy(
  codes: IamPermissionCode[],
  roles: readonly PermissionBearingRole[],
) {
  const manager = roles.some(
    ({ role }) =>
      role.isActive &&
      (role.code === 'administrator' ||
        role.code === 'sales_manager' ||
        role.code === 'sales-manager' ||
        role.name === 'مدیر فروش' ||
        role.name === 'مدیر'),
  );
  if (manager)
    return [
      ...new Set<IamPermissionCode>([
        ...codes,
        'sales.contracts.read.all',
        'sales.contracts.create',
      ]),
    ];
  const expert = roles.some(
    ({ role }) =>
      role.isActive &&
      (role.code === 'sales_staff' || role.name === 'کارشناس فروش'),
  );
  if (!expert) return codes;
  return [
    ...new Set(
      codes.map((code) =>
        code === 'sales.contracts.read.all' ||
        code === 'sales.contracts.read.branch'
          ? 'sales.contracts.read.own'
          : code === 'sales.contracts.update.branch'
            ? 'sales.contracts.update.own'
            : code,
      ),
    ),
  ];
}

export function authenticatedPermissionCodes(
  roles: readonly PermissionBearingRole[],
): IamPermissionCode[] {
  const snapshots = roles.filter(({ role }) =>
    role.code?.startsWith(MANUAL_ACCESS_ROLE_PREFIX),
  );
  // Do not resurrect shared grants when a snapshot is disabled or malformed.
  if (snapshots.length) {
    if (
      snapshots.length !== 1 ||
      !snapshots[0]!.role.isActive ||
      !snapshots[0]!.role.permissions.some(
        ({ permission }) => permission.code === MANUAL_ACCESS_VERSION,
      )
    )
      return [];
    return salesRolePolicy(
      [
        ...new Set(
          snapshots[0]!.role.permissions.map(
            ({ permission }) => permission.code as IamPermissionCode,
          ),
        ),
      ].filter((code) => code !== USER_ACCESS_ADMIN_PERMISSION),
      snapshots,
    );
  }
  const administrator = roles.some(
    ({ role }) => role.isActive && role.code === 'administrator',
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
        .filter(
          (code) =>
            code !== USER_ACCESS_ADMIN_PERMISSION &&
            code !== MANUAL_ACCESS_VERSION &&
            !code.startsWith('ui.allow.'),
        ),
      ...(administrator ? [USER_ACCESS_ADMIN_PERMISSION] : []),
    ]),
  ];
  return salesRolePolicy(codes, roles);
}
