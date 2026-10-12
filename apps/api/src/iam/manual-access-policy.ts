import { createHash } from 'node:crypto';
import {
  MANUAL_ACCESS_ROLE_PREFIX,
  MANUAL_ACCESS_VERSION,
  USER_ACCESS_PROFILE_PERMISSION,
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  canViewScreen,
  hasAccessControl,
  allowAccessControl,
  screenPermission,
  type ManualAccessSelection,
} from '@nora/contracts';
import {
  authenticatedPermissionCodes,
  type PermissionBearingRole,
} from './authenticated-permissions';

export interface ManualAccessUser {
  id: string;
  status: string;
  roles: Array<PermissionBearingRole & { role: { id: string } }>;
  branches: Array<{ branchId: string }>;
  b2bOrganizationUser?: { isActive: boolean; sections: string[] } | null;
}

export function manualAccessCatalogFingerprint() {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: MANUAL_ACCESS_VERSION,
        screens: USER_ACCESS_SCREENS.map((s) => s.id),
        controls: USER_ACCESS_DENY_CONTROLS.map((c) => c.id),
      }),
    )
    .digest('hex');
}

export function manualAccessRevision(user: ManualAccessUser): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: user.id,
        status: user.status,
        roles: user.roles
          .map(({ role }) => ({
            id: role.id,
            code: role.code,
            active: role.isActive,
            grants: role.permissions
              .map(({ permission }) => permission.code)
              .sort(),
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
        branches: user.branches.map((b) => b.branchId).sort(),
        portal: user.b2bOrganizationUser ?? null,
      }),
    )
    .digest('hex');
}

export function manualAccessSelection(
  user: Pick<ManualAccessUser, 'roles' | 'b2bOrganizationUser'>,
): ManualAccessSelection {
  const codes = authenticatedPermissionCodes(user.roles);
  const portal =
    !codes.includes(MANUAL_ACCESS_VERSION) && user.b2bOrganizationUser?.isActive
      ? user.b2bOrganizationUser.sections.map((s) => `b2b.portal.section.${s}`)
      : [];
  return {
    permissionCodes: [
      ...new Set([...codes.filter((c) => !c.startsWith('ui.')), ...portal]),
    ].sort(),
    screenIds: USER_ACCESS_SCREENS.filter((s) => canViewScreen(codes, s.id))
      .map((s) => s.id)
      .sort(),
    allowedControlIds: USER_ACCESS_DENY_CONTROLS.filter(
      (c) =>
        hasAccessControl(codes, c.id) &&
        (c.kind === 'field' ||
          c.id.startsWith('master-data.resource.') ||
          canViewScreen(codes, c.id)),
    )
      .map((c) => c.id)
      .sort(),
  };
}

export function manualSnapshotCodes(
  selection: ManualAccessSelection,
): string[] {
  return [
    ...new Set([
      MANUAL_ACCESS_VERSION,
      USER_ACCESS_PROFILE_PERMISSION,
      ...selection.permissionCodes,
      ...selection.screenIds.map(screenPermission),
      ...selection.allowedControlIds.map(allowAccessControl),
    ]),
  ].sort();
}

export function isManualAccessUser(user: Pick<ManualAccessUser, 'roles'>) {
  return user.roles.some(({ role }) =>
    role.code?.startsWith(MANUAL_ACCESS_ROLE_PREFIX),
  );
}

/** Pure preview used by the editor and migration; no DB writes and no title inference. */
export function previewManualConversion(user: ManualAccessUser) {
  const selection = manualAccessSelection(user);
  const after = manualAccessSelection({
    roles: [
      {
        role: {
          id: 'preview',
          code: MANUAL_ACCESS_ROLE_PREFIX + user.id,
          isActive: true,
          permissions: manualSnapshotCodes(selection).map((code) => ({
            permission: { code },
          })),
        },
      },
    ],
  });
  if (JSON.stringify(selection) !== JSON.stringify(after))
    throw new Error('Manual access conversion changes effective access');
  return {
    revision: manualAccessRevision(user),
    selection,
    alreadyManual: isManualAccessUser(user),
  };
}
