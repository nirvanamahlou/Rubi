import { MANUAL_ACCESS_ROLE_PREFIX } from '@nora/contracts';
import { roleLabel } from './role-label';

/** Match the server's manual-snapshot precedence without changing memberships. */
export function effectiveRoleLabels(
  roles: { role: { code: string; name: string; isActive: boolean } }[],
) {
  const snapshots = roles.filter(({ role }) =>
    role.code.startsWith(MANUAL_ACCESS_ROLE_PREFIX),
  );
  return (snapshots.length ? snapshots : roles)
    .filter(({ role }) => role.isActive)
    .map(({ role }) => roleLabel(role.name));
}
