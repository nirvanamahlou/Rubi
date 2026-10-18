import {
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  screenPermission,
  denyPermission,
  type ManualAccessSelection,
} from '@nora/contracts';
import { manualAccessSelection } from './manual-access-policy';
import { ROLE_TEMPLATE_PREFIX } from './role-directory';
import type { PermissionBearingRole } from './authenticated-permissions';
export function roleOptionSelection(
  role: PermissionBearingRole['role'] & { id: string },
): ManualAccessSelection {
  if (!role.code?.startsWith(ROLE_TEMPLATE_PREFIX))
    return manualAccessSelection({ roles: [{ role }] });
  const codes = role.permissions.map((p) => p.permission.code);
  return {
    permissionCodes: codes.filter((c) => !c.startsWith('ui.')),
    screenIds: USER_ACCESS_SCREENS.filter((s) =>
      codes.includes(screenPermission(s.id)),
    ).map((s) => s.id),
    allowedControlIds: USER_ACCESS_DENY_CONTROLS.filter(
      (c) =>
        !codes.includes(denyPermission(c.id)) &&
        (c.kind === 'field' ||
          c.id.startsWith('master-data.resource.') ||
          codes.includes(screenPermission(c.id))),
    ).map((c) => c.id),
  };
}
